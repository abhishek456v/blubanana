import { supabase } from './supabase'
import type { ExtractedDealFields } from '@/types'

// Calls the extract-deal edge function, which shares one extraction prompt
// for both screenshot and voice-note intake (PRODUCT.md 2.1).
async function invokeExtractDeal(
  body: { imageBase64: string; mimeType: string } | { transcript: string }
): Promise<ExtractedDealFields> {
  const { data, error } = await supabase.functions.invoke('extract-deal', { body })
  if (error) throw error
  if (!data?.fields) throw new Error('Extraction returned no fields')
  return data.fields as ExtractedDealFields
}

export function extractFromImage(
  imageBase64: string,
  mimeType: string
): Promise<ExtractedDealFields> {
  return invokeExtractDeal({ imageBase64, mimeType })
}

export function extractFromTranscript(transcript: string): Promise<ExtractedDealFields> {
  return invokeExtractDeal({ transcript })
}

export async function transcribeAudio(
  audioBase64: string,
  mimeType: string
): Promise<string> {
  const { data, error } = await supabase.functions.invoke('transcribe-audio', {
    body: { audioBase64, mimeType },
  })
  if (error) throw error
  const transcript = data?.transcript
  if (typeof transcript !== 'string' || !transcript.trim()) {
    throw new Error('No speech detected')
  }
  return transcript
}
