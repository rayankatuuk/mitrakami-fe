import { createElement } from 'react'
import { DEFAULT_LUCIDE_ICON, getLucideIcon } from '../utils/lucideIcons'

export default function AppIcon({ name, fallbackName, className, ...props }) {
  const Icon = getLucideIcon(name)
    || (fallbackName ? getLucideIcon(fallbackName) : null)
    || DEFAULT_LUCIDE_ICON

  return createElement(Icon, { className, 'aria-hidden': 'true', ...props })
}
