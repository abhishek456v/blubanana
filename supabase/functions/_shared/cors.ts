// Shared CORS headers for edge functions invoked from the Expo app (web target
// and Expo Go dev tools both go through a browser-like fetch at times).
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}
