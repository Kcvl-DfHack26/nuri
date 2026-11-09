import { profileInputSchema, profilePhotoMaxBytes } from '@starter/shared';
import sharp from 'sharp';
import { z } from 'zod';

// Decode only these raster formats. Re-encoding also strips metadata such as GPS coordinates.
sharp.block({ operation: ['VipsForeignLoad'] });
sharp.unblock({
  operation: ['VipsForeignLoadJpegBuffer', 'VipsForeignLoadPngBuffer', 'VipsForeignLoadWebpBuffer'],
});

export const profilePhotoFormSchema = z.strictObject({
  photo: z.instanceof(Blob).refine(({ size }) => size > 0 && size <= profilePhotoMaxBytes),
  changes: z
    .string()
    .transform((value, ctx): unknown => {
      try {
        return JSON.parse(value);
      } catch {
        ctx.addIssue({ code: 'custom', message: 'Invalid profile fields' });
        return z.NEVER;
      }
    })
    .pipe(profileInputSchema.partial().strict()),
});

export async function decodeProfilePhoto(file: Blob) {
  const bytes = await file.arrayBuffer();
  try {
    return await sharp(bytes, { autoOrient: true, failOn: 'warning', limitInputPixels: 32_000_000 })
      .resize({ width: 512, height: 512, fit: 'inside', withoutEnlargement: true })
      .flatten({ background: 'white' })
      .jpeg()
      .toBuffer();
  } catch {
    return null;
  }
}
