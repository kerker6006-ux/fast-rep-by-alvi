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
  customerAddress?: string
  items?: Array<{ name?: string; quantity?: number; price?: number }>
  total?: number
  appUrl?: string
}

const NewOrderEmail = ({
  pageName = 'your page',
  customerName = 'Customer',
  customerPhone = '—',
  customerAddress = '—',
  items = [],
  total = 0,
  appUrl = 'https://leadpilot.life',
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>New order from {customerName} — {pageName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>🛒 New order received</Heading>
        <Text style={text}>
          Your AI shopkeeper just confirmed a new order on <strong>{pageName}</strong>.
        </Text>

        <Section style={card}>
          <Text style={row}><strong>Customer:</strong> {customerName}</Text>
          <Text style={row}><strong>Phone:</strong> {customerPhone}</Text>
          <Text style={row}><strong>Address:</strong> {customerAddress}</Text>
          <Hr style={hr} />
          {items.length > 0 ? items.map((it, i) => (
            <Text key={i} style={row}>
              • {it.name || 'Item'} × {it.quantity || 1}
              {typeof it.price === 'number' ? ` — ৳${it.price}` : ''}
            </Text>
          )) : <Text style={row}>—</Text>}
          <Hr style={hr} />
          <Text style={total_}><strong>Total:</strong> ৳{Number(total || 0).toFixed(2)}</Text>
        </Section>

        <Section style={{ textAlign: 'center', margin: '28px 0' }}>
          <Button href={`${appUrl}/dashboard#orders`} style={button}>View order</Button>
        </Section>

        <Text style={muted}>You're seeing this because LeadPilot is watching your inbox 24/7. Adjust notification settings in Bot Settings.</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: NewOrderEmail,
  subject: (d: any) => `🛒 New order from ${d?.customerName || 'a customer'}`,
  displayName: 'New order alert',
  previewData: {
    pageName: 'My Shop',
    customerName: 'Rahim',
    customerPhone: '01711-000000',
    customerAddress: 'Dhanmondi, Dhaka',
    items: [{ name: 'Red Saree', quantity: 1, price: 1200 }],
    total: 1200,
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Inter, Arial, sans-serif' }
const container = { padding: '32px 28px', maxWidth: '560px' }
const h1 = { color: '#0f172a', fontSize: '22px', fontWeight: 700, margin: '0 0 12px' }
const text = { color: '#334155', fontSize: '15px', lineHeight: '24px', margin: '0 0 16px' }
const card = { backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '14px', padding: '18px 20px', margin: '16px 0' }
const row = { color: '#1e293b', fontSize: '14px', lineHeight: '22px', margin: '4px 0' }
const total_ = { color: '#0f172a', fontSize: '16px', lineHeight: '24px', margin: '6px 0' }
const hr = { borderColor: '#E2E8F0', margin: '10px 0' }
const muted = { color: '#64748b', fontSize: '12px', lineHeight: '20px', margin: '8px 0' }
const button = {
  backgroundColor: '#2563EB', color: '#ffffff', padding: '12px 24px',
  borderRadius: '14px', fontSize: '15px', fontWeight: 600, textDecoration: 'none',
}
