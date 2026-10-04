// Builds the sample Word templates in public/sample-templates.
// Run: node scripts/make-sample-templates.mjs
//
// These are starting points that companies can download and adapt. They use
// the same {{placeholders}} as uploaded templates. They are not legal advice:
// each company should have its own lawyer approve the wording.
import { writeFileSync, mkdirSync } from 'node:fs'
import {
  AlignmentType, BorderStyle, Document, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType,
} from 'docx'

const OUT = new URL('../public/sample-templates/', import.meta.url)
mkdirSync(OUT, { recursive: true })

const FONT = 'Calibri'
// Each run stays whole so a {{placeholder}} is never split across Word runs
const run = (text, opts = {}) => new TextRun({ text, font: FONT, size: 22, ...opts })
const p = (parts, opts = {}) => new Paragraph({
  spacing: { after: 160, line: 300 }, ...opts,
  children: (Array.isArray(parts) ? parts : [parts]).map(x => typeof x === 'string' ? run(x) : x),
})
const b = text => run(text, { bold: true })
const heading = text => new Paragraph({
  alignment: AlignmentType.CENTER, spacing: { before: 240, after: 280 },
  children: [run(text, { bold: true, size: 28, allCaps: true })],
})

const letterhead = () => [
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 40 }, children: [run('{{company_name}}', { bold: true, size: 36 })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 40 }, children: [run('{{company_address}}', { size: 18, color: '555555' })] }),
  new Paragraph({
    alignment: AlignmentType.CENTER, spacing: { after: 300 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: '2563EB', space: 8 } },
    children: [run('{{company_phone}}  ·  {{company_email}}', { size: 18, color: '555555' })],
  }),
]

const addressee = () => [
  p('{{today}}'),
  p([b('{{client_name}}')], { spacing: { after: 0 } }),
  p('{{client_address}}', { spacing: { after: 0 } }),
  p('Client number: {{client_number}}', { spacing: { after: 280 } }),
]

const signature = (left = 'For: {{company_name}}', right = null) => {
  const cell = text => new TableCell({
    width: { size: 50, type: WidthType.PERCENTAGE },
    borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
    children: text ? [
      p(' ', { spacing: { before: 600, after: 0 } }),
      p('______________________________', { spacing: { after: 40 } }),
      p(text),
    ] : [p(' ')],
  })
  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [new TableRow({ children: [cell(left), cell(right)] })] })
}

const kvTable = rows => new Table({
  width: { size: 100, type: WidthType.PERCENTAGE },
  rows: rows.map(([k, v]) => new TableRow({
    children: [
      new TableCell({ width: { size: 40, type: WidthType.PERCENTAGE }, children: [p([b(k)], { spacing: { after: 60 } })] }),
      new TableCell({ width: { size: 60, type: WidthType.PERCENTAGE }, children: [p(v, { spacing: { after: 60 } })] }),
    ],
  })),
})

const note = () => p([run('Sample template from DocuSend. Replace this wording with your company\'s approved document before use.', { italics: true, size: 16, color: '999999' })], { spacing: { before: 400 } })

const docs = {
  receipt: [
    ...letterhead(),
    heading('Payment Receipt'),
    kvTable([
      ['Receipt number', '{{receipt_number}}'],
      ['Date of payment', '{{payment_date}}'],
      ['Received from', '{{client_name}}'],
      ['Client number', '{{client_number}}'],
      ['Amount received', '{{amount_paid}}'],
      ['Amount in words', '{{amount_paid_words}}'],
      ['Payment method', '{{payment_method}}'],
      ['Bank reference', '{{bank_reference}}'],
      ['Being payment for', '{{units}} {{unit_label}} at {{property_name}}, {{property_location}}'],
      ['Payment plan', '{{plan_name}}'],
      ['Total price', '{{total_price}}'],
      ['Total paid to date', '{{total_paid}}'],
      ['Outstanding balance', '{{balance}}'],
    ]),
    p(' '),
    signature('Authorised signatory'),
    note(),
  ],
  acknowledgement: [
    ...letterhead(), ...addressee(),
    p([b('LETTER OF ACKNOWLEDGEMENT: {{property_name}}')]),
    p('Dear {{client_name}},'),
    p('We acknowledge with thanks your subscription to {{units}} {{unit_label}} at {{property_name}}, {{property_location}}, under the {{plan_name}} payment plan.'),
    p('We confirm receipt of {{amount_paid}} ({{amount_paid_words}}) paid on {{payment_date}}, receipt number {{receipt_number}}. The total price of your purchase is {{total_price}}, and your outstanding balance is {{balance}}.'),
    p('Your client number is {{client_number}}. Please quote it in all correspondence and on every subsequent payment.'),
    p('Thank you for choosing {{company_name}}. We look forward to a lasting relationship.'),
    p('Yours faithfully,'),
    signature(),
    note(),
  ],
  contract_of_sale: [
    ...letterhead(),
    heading('Contract of Sale'),
    p([run('THIS CONTRACT is made on '), b('{{purchase_date}}'), run(' BETWEEN:')]),
    p([b('{{company_name}}'), run(' of {{company_address}} (the "Vendor"); AND')]),
    p([b('{{client_name}}'), run(' of {{client_address}} (the "Purchaser"), client number {{client_number}}.')]),
    p([b('1. Property. '), run('The Vendor agrees to sell and the Purchaser agrees to buy {{units}} {{unit_label}} ({{total_size_sqm}} sqm in total) at {{property_name}}, {{property_location}}. Plot/unit number(s): {{plot_numbers}}.')]),
    p([b('2. Price. '), run('The total purchase price is {{total_price}} ({{total_price_words}}), payable under the {{plan_name}} plan.')]),
    p([b('3. Payment. '), run('A deposit of {{deposit}} is payable on signing. The balance is payable in {{duration_months}} equal monthly instalments. Payments are made by transfer to the Vendor\'s designated account.')]),
    p([b('4. Default. '), run('If the Purchaser fails to pay any instalment within {{grace_days}} days of its due date, the Vendor may, after written notice, revoke this contract in accordance with its refund policy.')]),
    p([b('5. Allocation. '), run('Physical allocation and the Deed of Assignment will be issued after full payment of the purchase price and all applicable fees.')]),
    p([b('6. Next of kin. '), run('The Purchaser names {{next_of_kin_name}} ({{next_of_kin_relationship}}, {{next_of_kin_phone}}) as next of kin.')]),
    p('Signed by the parties on the date above.'),
    signature('For the Vendor: {{company_name}}', 'The Purchaser: {{client_name}}'),
    note(),
  ],
  allocation_letter: [
    ...letterhead(), ...addressee(),
    p([b('LETTER OF ALLOCATION: {{property_name}}')]),
    p('Dear {{client_name}},'),
    p('Following the completion of payment for your purchase at {{property_name}}, {{property_location}}, we are pleased to allocate to you the following:'),
    kvTable([
      ['Plot / unit number(s)', '{{plot_numbers}}'],
      ['Number of units', '{{units}} {{unit_label}}'],
      ['Size', '{{total_size_sqm}} sqm'],
      ['Total price paid', '{{total_paid}}'],
    ]),
    p(' '),
    p('This allocation is subject to the terms of your Contract of Sale and the estate rules. Please contact us to arrange physical allocation on site.'),
    p('Congratulations on your new property.'),
    p('Yours faithfully,'),
    signature(),
    note(),
  ],
  deed_of_assignment: [
    ...letterhead(),
    heading('Deed of Assignment'),
    p([run('THIS DEED OF ASSIGNMENT is made on '), b('{{today}}'), run(' BETWEEN:')]),
    p([b('{{company_name}}'), run(' of {{company_address}} (the "Assignor"); AND')]),
    p([b('{{client_name}}'), run(' of {{client_address}} (the "Assignee").')]),
    p([b('WHEREAS '), run('the Assignor is the beneficial owner of the land known as {{property_name}}, {{property_location}}, and the Assignee has paid the full consideration of {{total_paid}} ({{total_paid_words}}).')]),
    p([b('NOW THIS DEED WITNESSES '), run('that the Assignor assigns to the Assignee all its rights and interest in {{units}} {{unit_label}} measuring {{total_size_sqm}} sqm in total, being plot/unit number(s) {{plot_numbers}}, to hold for the residue of the term.')]),
    p('IN WITNESS WHEREOF the parties have set their hands and seals on the date above.'),
    signature('Signed for the Assignor', 'Signed by the Assignee'),
    note(),
  ],
  provisional_survey: [
    ...letterhead(), ...addressee(),
    p([b('PROVISIONAL SURVEY PLAN: {{property_name}}')]),
    p('Dear {{client_name}},'),
    p('Please find below the provisional survey details for your allocation at {{property_name}}, {{property_location}}.'),
    kvTable([
      ['Plot / unit number(s)', '{{plot_numbers}}'],
      ['Size', '{{total_size_sqm}} sqm'],
      ['Client number', '{{client_number}}'],
    ]),
    p(' '),
    p('The registered survey will be processed after the payment of survey fees and the approval of the relevant authorities.'),
    p('Yours faithfully,'),
    signature(),
    note(),
  ],
  statement: [
    ...letterhead(), ...addressee(),
    heading('Statement of Account'),
    kvTable([
      ['Property', '{{property_name}}'],
      ['Plan', '{{plan_name}}'],
      ['Total price', '{{total_price}}'],
    ]),
    p(' '),
    p([b('Payments received')]),
    // A paragraph holding only {{#payments}} … {{/payments}} repeats what's between them
    p('{{#payments}}', { spacing: { after: 0 } }),
    p('{{date}}    {{amount}}    {{receipt}}', { spacing: { after: 60 } }),
    p('{{/payments}}', { spacing: { after: 0 } }),
    p([b('Total paid: {{total_paid}}')], { spacing: { after: 40 } }),
    p([b('Outstanding balance: {{balance}}')]),
    note(),
  ],
}

for (const [name, children] of Object.entries(docs)) {
  const doc = new Document({ sections: [{ properties: { page: { margin: { top: 1000, bottom: 1000, left: 1100, right: 1100 } } }, children }] })
  writeFileSync(new URL(`${name}.docx`, OUT), await Packer.toBuffer(doc))
  console.log('wrote', name)
}
