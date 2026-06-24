/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Preview, Section, Text, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Props {
  pageName?: string
  customerName?: string
  customerPhone?: string
  details?: string
  appUrl?: string
}

const NewAppointmentEmail = ({
  pageName = 'your page',
  customerName = 'Customer',
  customerPhone = '—',
  details = '',
  appUrl = 'https://leadpilot.life',
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>New callback / appointment request from {customerName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>📞 New callback request</Heading>
        <Text style={text}>
          A customer on <strong>{pageName}</strong> is asking for a callback / appointment.
        </Text>
        <Section style={card}>
          <Text style={row}><strong>Customer:</strong> {customerName}</Text>
          <Text style={row}><strong>Phone:</strong> {customerPhone}</Text>
          {details ? (<><Hr style={hr} /><Text style={row}>{details}</Text></>) : null}
        </Section>
        <Section style={{ textAlign: 'center', margin: '28px 0' }}>
          <Button href={`${appUrl}/dashboard#complaints`} style={button}>Open dashboard</Button>
        </Section>
        <Text style={muted}>LeadPilot watches your inbox 24/7 so you never miss a lead.</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: NewAppointmentEmail,
  subject: (d: any) => `📞 Callback request from ${d?.customerName || 'a customer'}`,
  displayName: 'New appointment / callback alert',
  previewData: {
    pageName: 'My Salon',
    customerName: 'Sara',
    customerPhone: '01711-000000',
    details: 'Wants to book a haircut for Friday.',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Inter, Arial, sans-serif' }
const container = { padding: '32px 28px', maxWidth: '560px' }
const h1 = { color: '#0f172a', fontSize: '22px', fontWeight: 700, margin: '0 0 12px' }
const text = { color: '#334155', fontSize: '15px', lineHeight: '24px', margin: '0 0 16px' }
const card = { backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '14px', padding: '18px 20px', margin: '16px 0' }
const row = { color: '#1e293b', fontSize: '14px', lineHeight: '22px', margin: '4px 0' }
const hr = { borderColor: '#E2E8F0', margin: '10px 0' }
const muted = { color: '#64748b', fontSize: '12px', lineHeight: '20px', margin: '8px 0' }
const button = {
  backgroundColor: '#2563EB', color: '#ffffff', padding: '12px 24px',
  borderRadius: '14px', fontSize: '15px', fontWeight: 600, textDecoration: 'none',
}
