import { naira, fmtDate, mailto } from './format'

// Ready-made messages. They open in the staff member's email app for now;
// sending from inside DocuSend comes with the email integration.
const bankLines = org => org.account_number
  ? `\n\nPayment details:\n${org.bank_name || ''}\n${org.account_name || ''}\n${org.account_number}`
  : ''

const signOff = org => `\n\nKind regards,\n${org.name}${org.phone ? '\n' + org.phone : ''}`

export function reminderEmail(org, p) {
  const late = p.payment_status === 'defaulting'
  return mailto({
    to: p.client_email,
    cc: p.realtor_email,
    subject: `${late ? 'Overdue payment' : 'Payment reminder'}: ${p.property_name} (${p.client_number})`,
    body: `Dear ${p.client_name},\n\n`
      + (late
        ? `Our records show that your payments for ${p.property_name} are ${p.days_overdue} days overdue. The overdue amount is ${naira(p.amount_overdue)}.`
        : `This is a friendly reminder that a payment of ${naira(p.amount_overdue)} is due on your ${p.property_name} purchase.`)
      + `\n\nClient number: ${p.client_number}\nTotal price: ${naira(p.total_price)}\nPaid so far: ${naira(p.amount_paid)}\nOutstanding balance: ${naira(p.balance)}`
      + bankLines(org)
      + `\n\nIf you have already paid, please reply with your proof of payment, or submit it on our payment form. Thank you.`
      + signOff(org),
  })
}

export function statementEmail(org, p, payments) {
  const lines = payments.filter(x => x.status === 'confirmed')
    .map(x => `${fmtDate(x.paid_on)}  ${naira(x.amount)}  ${x.receipt_number || ''}`).join('\n')
  return mailto({
    to: p.client_email,
    cc: p.realtor_email,
    subject: `Statement of account: ${p.property_name} (${p.client_number})`,
    body: `Dear ${p.client_name},\n\nPlease find your statement of account below.\n\n`
      + `Property: ${p.property_name}\nClient number: ${p.client_number}\nPlan: ${p.plan_name}\n\n`
      + `Payments received:\n${lines || 'None yet'}\n\n`
      + `Total price: ${naira(p.total_price)}\nTotal paid: ${naira(p.amount_paid)}\nBalance: ${naira(p.balance)}`
      + signOff(org),
  })
}

export function blankEmail(org, client, purchase) {
  return mailto({ to: client.email, cc: purchase?.realtor_email, subject: `${org.name}`, body: `Dear ${client.full_name},\n\n` + signOff(org) })
}
