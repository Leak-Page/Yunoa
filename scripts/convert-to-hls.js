/**
 * Script de conversion MP4 → HLS avec watermarking
 * Utilise FFmpeg pour convertir et ajouter le watermark
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs/promises';

const execAsync = promisify(exec);

/**
 * Convertit un MP4 en HLS avec watermarking
 * @param {string} inputPath - Chemin du fichier MP4
 * @param {string} outputDir - Répertoire de sortie
 * @param {string} watermarkText - Texte du watermark (ID utilisateur/email)
 * @returns {Promise<string>} - Chemin de la playlist .m3u8
 */
export async function convertToHLS(inputPath, outputDir, watermarkText) {
  try {
    // Créer le répertoire de sortie s'il n'existe pas
    await fs.mkdir(outputDir, { recursive: true });

    const playlistPath = path.join(outputDir, 'playlist.m3u8');
    const segmentPattern = path.join(outputDir, 'segment_%03d.ts');

    // Commande FFmpeg avec watermarking
    const ffmpegCommand = `ffmpeg -i "${inputPath}" \
      -vf "drawtext=text='${watermarkText}':fontsize=24:fontcolor=white@0.5:x=10:y=10:box=1:boxcolor=black@0.5" \
      -c:v libx264 \
      -c:a aac \
      -f hls \
      -hls_time 10 \
      -hls_list_size 0 \
      -hls_segment_filename "${segmentPattern}" \
      -hls_flags delete_segments \
      "${playlistPath}"`;

    console.log(`[HLS Conversion] Conversion de ${inputPath} en HLS...`);
    console.log(`[HLS Conversion] Watermark: ${watermarkText}`);

    const { stdout, stderr } = await execAsync(ffmpegCommand);

    if (stderr) {
      console.warn('[HLS Conversion] Avertissements FFmpeg:', stderr);
    }

    console.log(`[HLS Conversion] ✅ Conversion terminée: ${playlistPath}`);
    return playlistPath;

  } catch (error) {
    console.error('[HLS Conversion] ❌ Erreur:', error);
    throw error;
  }
}

/**
 * Convertit un MP4 en HLS sans watermarking (pour le cache)
 */
export async function convertToHLSCached(inputPath, outputDir) {
  try {
    await fs.mkdir(outputDir, { recursive: true });

    const playlistPath = path.join(outputDir, 'playlist.m3u8');
    const segmentPattern = path.join(outputDir, 'segment_%03d.ts');

    const ffmpegCommand = `ffmpeg -i "${inputPath}" \
      -c:v libx264 \
      -c:a aac \
      -f hls \
      -hls_time 10 \
      -hls_list_size 0 \
      -hls_segment_filename "${segmentPattern}" \
      -hls_flags delete_segments \
      "${playlistPath}"`;

    const { stdout, stderr } = await execAsync(ffmpegCommand);

    if (stderr) {
      console.warn('[HLS Conversion] Avertissements FFmpeg:', stderr);
    }

    return playlistPath;

  } catch (error) {
    console.error('[HLS Conversion] ❌ Erreur:', error);
    throw error;
  }
}

