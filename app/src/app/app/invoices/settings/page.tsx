import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { requireOrganisation } from "@/lib/auth/dal";
import { canEditBusinessProfile } from "@/lib/business-profile";
import { DEFAULT_CREDIT_NOTE_PREFIX, DEFAULT_INVOICE_PREFIX, formatDocumentNumber } from "@/lib/quotes/numbering";
import { getCreditNoteSequences, getInvoiceSequences, sequenceFor } from "@/lib/quotes/sequence";
import { QuoteNumberingForm } from "../../quotes/settings/quote-numbering-form";

/**
 * Invoice settings: how invoices and credit notes are numbered. They live with the invoices (reached from the Invoices
 * page); invoice wording and defaults will be added here.
 */
export default async function InvoiceSettingsPage() {
  const [{ organisation, role }, invoiceSequences, creditSequences] = await Promise.all([requireOrganisation(), getInvoiceSequences(), getCreditNoteSequences()]);
  const invoiceSequence = sequenceFor(invoiceSequences, organisation.id, DEFAULT_INVOICE_PREFIX);
  const creditSequence = sequenceFor(creditSequences, organisation.id, DEFAULT_CREDIT_NOTE_PREFIX);
  const canEdit = canEditBusinessProfile(role);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 px-4 py-8">
      <PageHeader back={{ href: "/app/invoices", label: "Invoices" }}>
        <h1 className="text-xl font-semibold">Invoice settings</h1>
      </PageHeader>

      {canEdit ? (
        <QuoteNumberingForm
          docType="invoice"
          initialPrefix={invoiceSequence.prefix}
          initialNext={invoiceSequence.nextNumber}
          minDigits={invoiceSequence.minDigits}
          lastIssued={invoiceSequence.lastIssued}
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Invoice numbers</CardTitle>
            <CardDescription className="text-base">
              Next invoice: {formatDocumentNumber(invoiceSequence.prefix, invoiceSequence.nextNumber, invoiceSequence.minDigits)}. Only owners and admins can change numbering.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {canEdit ? (
        <QuoteNumberingForm
          docType="credit_note"
          initialPrefix={creditSequence.prefix}
          initialNext={creditSequence.nextNumber}
          minDigits={creditSequence.minDigits}
          lastIssued={creditSequence.lastIssued}
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Credit note numbers</CardTitle>
            <CardDescription className="text-base">
              Next credit note: {formatDocumentNumber(creditSequence.prefix, creditSequence.nextNumber, creditSequence.minDigits)}. Only owners and admins can change numbering.
            </CardDescription>
          </CardHeader>
        </Card>
      )}
    </main>
  );
}
