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
  p([b('{{client_name_full}}')], { spacing: { after: 0 } }),
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

const cellP = (text, opts = {}) => new TableCell({
  margins: { top: 80, bottom: 80, left: 100, right: 100 },
  children: [new Paragraph({ spacing: { after: 0 }, children: [run(text, opts)] })],
})
// One header row, then one row that repeats for every payment
const paymentsTable = () => new Table({
  width: { size: 100, type: WidthType.PERCENTAGE },
  rows: [
    new TableRow({ tableHeader: true, children: ['S/N', 'PROPERTY', 'DESCRIPTION', 'AMOUNT (₦)', 'DATE'].map(h => cellP(h, { bold: true })) }),
    new TableRow({ children: [
      cellP('{{#payments}}{{sn}}'), cellP('{{property_name_upper}}'), cellP('{{label}}{{#total_size_sqm}} for {{total_size_sqm}}sqm{{/total_size_sqm}}'),
      cellP('{{amount}}'), cellP('{{date}}{{/payments}}'),
    ] }),
  ],
})
const right = (parts, opts = {}) => p(parts, { alignment: AlignmentType.RIGHT, ...opts })

const note = () => p([run('Sample template from DocuSend. Replace this wording with your company\'s approved document before use.', { italics: true, size: 16, color: '999999' })], { spacing: { before: 400 } })

const docs = {
  receipt: [
    ...letterhead(),
    right([b('{{#company_rc_number}}RC {{company_rc_number}}{{/company_rc_number}}')], { spacing: { after: 0 } }),
    heading('Payment Receipt'),
    right([b('Receipt No: {{receipt_number}}')]),
    p([b('Client name: '), run('{{client_name_upper}}')], { spacing: { after: 60 } }),
    p([b('Client number: '), run('{{client_number}}')], { spacing: { after: 60 } }),
    p([b('Phone: '), run('{{client_phone}}')], { spacing: { after: 60 } }),
    p([b('Email: '), run('{{client_email}}')], { spacing: { after: 240 } }),
    paymentsTable(),
    p(' '),
    right([b('Total property amount: {{total_price}}')], { spacing: { after: 60 } }),
    right([b('Total amount paid: {{total_paid}}')], { spacing: { after: 60 } }),
    right([b('Balance: {{balance}}')]),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 400 }, children: [run('THANK YOU FOR YOUR PROMPT PAYMENT.', { bold: true })] }),
    note(),
  ],
  acknowledgement: [
    ...letterhead(),
    right([b('{{#company_rc_number}}RC {{company_rc_number}}{{/company_rc_number}}')]),
    p('{{today}}'),
    p('To:', { spacing: { after: 60 } }),
    p('{{client_name_full}}', { spacing: { after: 60 } }),
    p('{{client_address}}', { spacing: { after: 280 } }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 240 }, children: [run('ACKNOWLEDGEMENT LETTER', { bold: true, underline: {} })] }),
    p('We are glad to acknowledge the receipt of payment for {{units}} {{unit_label}}{{#total_size_sqm}} ({{total_size_sqm}}sqm){{/total_size_sqm}} in {{property_name}}, {{property_location}}. The amount received, {{payment_status}}, is {{amount_paid_words}} ({{amount_paid}}), paid on {{payment_date}} towards the total price of {{total_price_words}} ({{total_price}}) on the {{plan_name}} plan.'),
    p('{{#client_number}}Your client number is {{client_number}}. Please quote it on every payment and in all correspondence.{{/client_number}}{{^client_number}}Your client number will be sent to you once your payment is confirmed.{{/client_number}}'),
    p('We look forward to a lasting relationship with you as you take this step towards a limitless opportunity.'),
    p('Thank you!'),
    p('Sincerely,', { spacing: { before: 240, after: 60 } }),
    p([b('Management, {{company_name}}')]),
    note(),
  ],
  contract_of_sale: [
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 1600, after: 600 }, children: [run('CONTRACT OF SALE', { bold: true, size: 56 })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 400 }, children: [run('BETWEEN', { bold: true, italics: true, size: 28 })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 80 }, children: [run('{{company_name}}', { bold: true, size: 28, allCaps: true })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 400 }, children: [run('(VENDOR)', { bold: true, size: 24 })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 400 }, children: [run('AND', { bold: true, italics: true, size: 28 })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 80 }, children: [run('{{client_name_upper}}', { bold: true, size: 28 })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 800 }, children: [run('(PURCHASER)', { bold: true, size: 24 })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, children: [run('IN RESPECT OF ALL THAT {{units}} {{unit_label}}{{#total_size_sqm}} MEASURING {{total_size_sqm}} SQUARE METRES{{/total_size_sqm}} IN {{property_name_upper}}, LYING AND BEING AT {{property_location_upper}}.', { bold: true, italics: true, size: 24, allCaps: true })] }),
    new Paragraph({ pageBreakBefore: true, spacing: { after: 200 }, children: [run('THIS CONTRACT OF SALE', { bold: true, italics: true, size: 26 }), run(' is made this '), b('{{purchase_date_long}}')] }),
    p([b('BETWEEN')]),
    p([b('{{company_name}}'), run('{{#company_rc_number}} (RC {{company_rc_number}}){{/company_rc_number}}, a company duly registered in Nigeria with its office at {{company_address}} (hereinafter referred to as the "Vendor", which expression shall where the context so admits include its successors-in-title, legal representatives and assigns) of the '), b('ONE PART'), run('.')]),
    p([b('AND')]),
    p([b('{{client_name_upper}}'), run(' of {{client_address}} (hereinafter referred to as the "Purchaser", which expression shall where the context so admits include {{his_her}} successors-in-title, personal and legal representatives and assigns) of the '), b('OTHER PART'), run('.')]),
    p([b('WHEREAS')]),
    p('1. The land, subject matter of this contract, forms part of the estate known as {{property_name}}, lying and being at {{property_location}}.'),
    p('2. The Vendor is the owner, manager and developer of the estate and has the authority to sell and assign parcels of land within it.'),
    p('3. The Vendor is desirous of assigning its interest in {{units}} {{unit_label}}{{#total_size_sqm}} ({{total_size_sqm}} square metres){{/total_size_sqm}} within the estate to the Purchaser, and the Purchaser has agreed to purchase it on the terms of this contract.'),
    p([b('NOW THIS CONTRACT WITNESSES AS FOLLOWS:')]),
    p([b('1. CONSIDERATION. '), run('In consideration of the sum of '), b('{{total_price}} ({{total_price_words}})'), run(' being the purchase price of the land:')]),
    p([run('a. A payment of '), b('{{total_paid}} ({{total_paid_words}})'), run(' has been made, the receipt of which the Vendor acknowledges.')], { indent: { left: 400 } }),
    p([run('b. The balance of '), b('{{balance}} ({{balance_words}})'), run(' shall be paid within '), b('{{duration_months}} ({{duration_months_words}})'), run(' months from the date of this contract.')], { indent: { left: 400 } }),
    p([b('2. THE VENDOR COVENANTS '), run('that it has good title and authority to sell the land; that the land is free from any charge, dispute or prior sale; and that upon full payment it shall execute and hand over to the Purchaser the payment receipt, deed of assignment, provisional survey plan and all documents evidencing the transfer of ownership.')]),
    p([b('3. THE PURCHASER COVENANTS '), run('to use the land only for lawful purposes consistent with the estate regulations; not to erect any illegal structure; and, on any resale before completion, to inform the Vendor in writing and pay the applicable transfer processing fee.')]),
    p([b('4. POSSESSION. '), run('The Purchaser shall be deemed to have taken possession when the land is allocated to {{him_her}} by the Vendor, being plot/unit number(s) {{plot_numbers}}.')]),
    p([b('5. DEFAULT. '), run('If the Purchaser fails to pay an instalment within {{grace_days}} days of its due date, the Vendor shall send a written notice of default. Continued default entitles the Vendor to terminate this contract and reallocate the land in accordance with its refund policy.')]),
    p([b('6. COMPLETION. '), run('This sale shall be complete upon full payment, the execution of the deed of assignment and the issue of the survey documents.')]),
    p([b('7. TERMINATION AND REFUND. '), run('Refunds, where applicable, are subject to the Vendor\'s published refund policy and administrative charges, and shall bear no interest.')]),
    p([b('8. DISPUTE RESOLUTION. '), run('The parties shall resolve any dispute amicably, failing which it shall be referred to arbitration in accordance with the Arbitration and Mediation Act 2023.')]),
    p([b('9. FORCE MAJEURE. '), run('Neither party shall be liable for delay caused by events beyond its reasonable control, provided written notice is given within forty-five (45) days of the event.')]),
    p([b('IN WITNESS WHEREOF'), run(' the parties have executed this contract on the date first above written.')], { spacing: { before: 240 } }),
    p('The common seal of {{company_name}} (VENDOR) is affixed in the presence of:'),
    signature('DIRECTOR', 'DIRECTOR / SECRETARY'),
    p([b('SIGNED, SEALED AND DELIVERED BY THE WITHIN-NAMED PURCHASER')], { spacing: { before: 400 } }),
    signature('{{client_name_upper}}'),
    p([b('IN THE PRESENCE OF:')], { spacing: { before: 240 } }),
    p('Name: ………………………………………………………………………'),
    p('Address: ……………………………………………………………………'),
    p('Occupation: …………………………………  Signature: ……………………………'),
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
    p([run('THIS DEED OF ASSIGNMENT is made this '), b('{{today_long}}'), run(' BETWEEN:')]),
    p([b('{{company_name}}'), run(' of {{company_address}} (the "Assignor"); AND')]),
    p([b('{{client_name_upper}}'), run(' of {{client_address}} (the "Assignee").')]),
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
    paymentsTable(),
    p(' '),
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
