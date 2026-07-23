import { Platform } from 'react-native'
import * as Print from 'expo-print'
import * as Sharing from 'expo-sharing'

// Web's Print.printAsync opens the browser print dialog directly (no
// filesystem involved). Native has no such dialog, so it renders to a PDF
// file first and hands off to the share sheet, which is where "Save to
// Files" / AirDrop / etc. live on iOS and Android.
export async function shareInvoicePdf(html: string, dialogTitle: string): Promise<void> {
  if (Platform.OS === 'web') {
    await Print.printAsync({ html })
    return
  }

  const { uri } = await Print.printToFileAsync({ html })
  const available = await Sharing.isAvailableAsync()
  if (available) {
    await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle })
  }
}
