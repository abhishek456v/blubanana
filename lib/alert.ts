import { Alert, Platform } from 'react-native'

interface AlertButton {
  text: string
  style?: 'default' | 'cancel' | 'destructive'
  onPress?: () => void
}

// react-native-web's Alert.alert is a no-op (see
// node_modules/react-native-web/dist/exports/Alert/index.js — the whole
// implementation is `static alert() {}`), so every validation/error message
// in this app would silently vanish on web without this. Falls back to the
// browser's own alert/confirm — not styled to match DESIGN.md, but correct
// and immediate, which matters far more than a button that just stops
// spinning with no explanation.
export function showAlert(title: string, message?: string, buttons?: AlertButton[]): void {
  if (Platform.OS !== 'web') {
    Alert.alert(title, message, buttons)
    return
  }

  const text = message ? `${title}\n\n${message}` : title

  if (!buttons || buttons.length <= 1) {
    window.alert(text)
    buttons?.[0]?.onPress?.()
    return
  }

  // window.confirm only gives OK/Cancel, so this maps the 'cancel'-styled
  // button to Cancel and the other (default/destructive) button to OK —
  // matches every multi-button call site in this app today.
  const cancelButton = buttons.find((b) => b.style === 'cancel')
  const actionButton = buttons.find((b) => b.style !== 'cancel') ?? buttons[0]
  if (window.confirm(text)) {
    actionButton?.onPress?.()
  } else {
    cancelButton?.onPress?.()
  }
}
