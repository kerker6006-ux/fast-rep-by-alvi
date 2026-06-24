/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Props {
  inviterName?: string
  inviterEmail?: string
  pageName?: string
  roleLabel?: string
  acceptUrl?: string
}

const PageInviteEmail = ({
  inviterName = 'Someone',
  inviterEmail,
  pageName = 'their Facebook page',
  roleLabel = 'Moderator',
  acceptUrl = 'https://leadpilot.life',
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>You've been invited to manage {pageName} on LeadPilot</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>You're invited 👋</Heading>
        <Text style={text}>
          <strong>{inviterName}</strong>{inviterEmail ? ` (${inviterEmail})` : ''} invited you
          to help manage <strong>{pageName}</strong> on LeadPilot as a <strong>{roleLabel}</strong>.
        </Text>
        <Text style={text}>
          {roleLabel === 'Full Access'
            ? 'Full Access lets you do everything on this page except disconnecting it — including inviting more teammates.'
            : 'As a Moderator you can read conversations, manage orders and callback requests, but cannot change settings, products, or billing.'}
        </Text>
        <Section style={{ textAlign: 'center', margin: '32px 0' }}>
          <Button href={acceptUrl} style={button}>Accept invite</Button>
        </Section>
        <Text style={muted}>
          This invite expires in 14 days. If you don't recognize {inviterName}, you can safely ignore this email.
        </Text>
        <Text style={muted}>— The LeadPilot team</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: PageInviteEmail,
  subject: (d: any) => `${d?.inviterName || 'Someone'} invited you to manage ${d?.pageName || 'a page'} on LeadPilot`,
  displayName: 'Page invite',
  previewData: {
    inviterName: 'Alvi',
    inviterEmail: 'alvi@example.com',
    pageName: 'My Shop',
    roleLabel: 'Moderator',
    acceptUrl: 'https://leadpilot.life/accept-invite?token=demo',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Inter, Arial, sans-serif' }
const container = { padding: '32px 28px', maxWidth: '560px' }
const h1 = { color: '#0f172a', fontSize: '24px', fontWeight: 700, margin: '0 0 16px' }
const text = { color: '#334155', fontSize: '15px', lineHeight: '24px', margin: '0 0 16px' }
const muted = { color: '#64748b', fontSize: '13px', lineHeight: '20px', margin: '8px 0' }
const button = {
  backgroundColor: '#2563EB', color: '#ffffff', padding: '12px 24px',
  borderRadius: '14px', fontSize: '15px', fontWeight: 600, textDecoration: 'none',
}
