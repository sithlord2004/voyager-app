// Give every free-text field a one-tap clear (×) button, so users don't have to
// hold backspace. We do this by switching text inputs to type="search", which
// makes the browser render its native clear button (Safari/Chrome/Firefox). A
// MutationObserver covers inputs that appear later (in modals, etc.).
//
// We deliberately skip password, date, file, checkbox, number and email fields.
const SELECTOR = 'input:not([type]), input[type="text"], input[type="search"]'

function enhance(node) {
  const targets = []
  if (node.matches && node.matches(SELECTOR)) targets.push(node)
  if (node.querySelectorAll) node.querySelectorAll(SELECTOR).forEach(el => targets.push(el))
  for (const el of targets) {
    if (el.dataset.clearable) continue
    el.dataset.clearable = '1'
    if (el.type !== 'search') el.type = 'search'
    // Search fields can otherwise pop up a browser search-history menu.
    if (!el.getAttribute('autocomplete')) el.setAttribute('autocomplete', 'off')
  }
}

export function initClearableInputs() {
  const run = () => enhance(document.body)
  run()
  const mo = new MutationObserver(muts => {
    for (const m of muts) for (const n of m.addedNodes) if (n.nodeType === 1) enhance(n)
  })
  mo.observe(document.body, { childList: true, subtree: true })
}
