import { createPortal } from 'react-dom'

// Renders a modal at the top level of the document instead of inside the page.
//
// Why this is needed: each view's root element animates (fadeUp), which makes it
// a stacking context, and it sits inside `.main`. A `position: fixed` overlay
// nested in there is trapped by that context — it paints *below* the fixed
// header and bottom tab bar, so the top of the modal is hidden under the header
// and its buttons can fall behind the nav. Portalling to <body> escapes all of
// that, so overlays truly cover the screen.
export default function ModalPortal({ children }) {
  return createPortal(children, document.body)
}
