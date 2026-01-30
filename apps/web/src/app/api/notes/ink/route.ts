import { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { errorResponse, successResponse } from '@/lib/api-utils';
import { generateInkCaption } from '@/lib/gemini';

// Ink data structure from InkCanvas component
interface InkData {
  strokes: Array<{
    id: string;
    points: Array<{
      x: number;
      y: number;
      pressure: number;
      tiltX?: number;
      tiltY?: number;
      timestamp: number;
    }>;
    color: string;
    size: number;
  }>;
  width: number;
  height: number;
  createdAt: string;
  devicePixelRatio: number;
}

const INK_BUCKET = 'ink-images';

// Ensure bucket exists (create if not)
async function ensureBucketExists(supabase: ReturnType<typeof getSupabaseAdmin>) {
  const { data: buckets } = await supabase.storage.listBuckets();
  const bucketExists = buckets?.some(b => b.name === INK_BUCKET);
  
  if (!bucketExists) {
    const { error } = await supabase.storage.createBucket(INK_BUCKET, {
      public: false,
      fileSizeLimit: 5 * 1024 * 1024, // 5MB
      allowedMimeTypes: ['image/png', 'image/jpeg'],
    });
    if (error && !error.message.includes('already exists')) {
      console.error('Error creating bucket:', error);
    }
  }
}

// POST /api/notes/ink - Create ink note from web (with Clerk auth)
export async function POST(req: NextRequest) {
  try {
    // Authenticate with Clerk
    const { userId } = await auth();
    if (!userId) {
      return errorResponse('unauthorized', 'Authentication required', 401);
    }

    // Parse multipart form data
    const formData = await req.formData();
    const inkDataStr = formData.get('inkData');
    const imageBlob = formData.get('image');

    if (!inkDataStr || typeof inkDataStr !== 'string') {
      return errorResponse('validation_error', 'inkData is required', 400);
    }

    if (!imageBlob || !(imageBlob instanceof Blob)) {
      return errorResponse('validation_error', 'image is required', 400);
    }

    // Parse ink data
    let inkData: InkData;
    try {
      inkData = JSON.parse(inkDataStr);
    } catch {
      return errorResponse('validation_error', 'Invalid inkData JSON', 400);
    }

    // Validate ink data structure
    if (!inkData.strokes || !Array.isArray(inkData.strokes) || inkData.strokes.length === 0) {
      return errorResponse('validation_error', 'No strokes in ink data', 400);
    }

    const supabase = getSupabaseAdmin();

    // Ensure bucket exists
    await ensureBucketExists(supabase);

    // Upload image to Supabase Storage
    const imageBuffer = Buffer.from(await imageBlob.arrayBuffer());
    const timestamp = Date.now();
    const imagePath = `${userId}/ink_${timestamp}.png`;

    const { error: uploadError } = await supabase.storage
      .from(INK_BUCKET)
      .upload(imagePath, imageBuffer, {
        contentType: 'image/png',
        upsert: false,
      });

    if (uploadError) {
      console.error('Error uploading ink image:', uploadError);
      // Continue without image - caption job will still try to process ink_json
    }

    // Convert InkCanvas format to database format
    const dbInkJson = {
      canvas_w: inkData.width,
      canvas_h: inkData.height,
      strokes: inkData.strokes.map(stroke => ({
        color: stroke.color,
        size: stroke.size,
        pts: stroke.points.map(p => ({
          x: p.x,
          y: p.y,
          p: p.pressure,
          t: p.timestamp,
          tiltX: p.tiltX,
          tiltY: p.tiltY,
        })),
      })),
      captured_at_ms: new Date(inkData.createdAt).getTime(),
      device_pixel_ratio: inkData.devicePixelRatio,
      client_meta: {
        source: 'web',
        captured_at: inkData.createdAt,
      },
    };

    // Generate caption synchronously
    let ink_caption = '';
    if (!uploadError) {
      try {
        // Download image from Supabase Storage (as buffer)
        const { data: imageData, error: downloadError } = await supabase.storage
          .from(INK_BUCKET)
          .download(imagePath);
        if (!downloadError && imageData) {
          const arrayBuffer = await imageData.arrayBuffer();
          const base64 = Buffer.from(arrayBuffer).toString('base64');
          ink_caption = await generateInkCaption(base64);
        }
      } catch (e) {
        console.error('Gemini Vision error:', e);
      }
    }
    // Fallback if caption is empty
    if (!ink_caption) {
      const strokeCount = dbInkJson.strokes?.length || 0;
      ink_caption = `Handwritten note (${strokeCount} strokes)`;
    }

    // Create ink note with caption
    const { data: note, error } = await supabase
      .from('notes')
      .insert({
        user_id: userId,
        type: 'ink',
        ink_json: dbInkJson,
        ink_image_path: uploadError ? null : imagePath,
        ink_caption,
        tags: [],
      })
      .select('id')
      .single();

    if (error || !note) {
      console.error('Error creating ink note:', error);
      return errorResponse('database_error', 'Failed to create note', 500);
    }

    return successResponse(
      {
        note_id: note.id,
        image_path: uploadError ? null : imagePath,
        ink_caption,
      },
      201
    );
  } catch (error) {
    console.error('Error in POST /api/notes/ink:', error);
    return errorResponse('internal_error', 'Internal server error', 500);
  }
}
