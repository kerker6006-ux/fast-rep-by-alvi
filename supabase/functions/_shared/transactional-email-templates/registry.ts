import * as React from 'npm:react@18.3.1'

export interface TemplateEntry {
  component: (props: any) => React.ReactElement
  subject: string | ((data: any) => string)
  displayName?: string
  previewData?: Record<string, any>
  to?: string
}

import { template as welcome } from './welcome.tsx'
import { template as subscriptionActivated } from './subscription-activated.tsx'

export const TEMPLATES: Record<string, TemplateEntry> = {
  'welcome': welcome,
  'subscription-activated': subscriptionActivated,
}
