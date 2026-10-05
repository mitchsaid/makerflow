# South Africa (ZA): bank details on documents

> **Applies to businesses whose country is South Africa (`country_code` = `ZA`) and to no one else.** The fields live in the South African locale pack (`app/src/lib/locale/za.ts`, `payment.bankFields`). Other countries get their own fields in their own packs.

## What a South African EFT needs
Account holder, bank, account type, account number and branch code. A customer paying from a banking app needs the first four and the branch code (or picks the bank, which fills it). The payment reference is how the maker matches a payment to a document, so the pack offers to print the document number as the reference.

## The checks, and how sure we are
| Rule | Where | Confidence |
|---|---|---|
| Account number: digits only, 7 to 16 of them (spaces and hyphens are ignored and removed) | `validateAccountNumber` | **Not checked against a bank source.** The range is deliberately wide: banks use different lengths (commonly 9 to 11) and a wrong rejection would stop a maker from saving a correct number. It only catches typing mistakes like letters, not wrong numbers. |
| Branch code: exactly 6 digits | `validateBranchCode` | Known format for South African branch codes, including universal codes. **Not checked against a bank's list.** |
| Account type: Cheque or current, Savings, Transmission | `ZA_ACCOUNT_TYPES` | The common personal and business types. Other types (credit card, bond) are not accounts customers pay into. |

## Not done, on purpose
- **No branch-code suggestions from the bank's name.** A wrong branch code can send money to the wrong place, and we have no source for the codes to check against. The maker types the code from their own bank app or statement.
- **No account verification** (such as a bank's account verification service). A later decision, with its own cost and privacy questions.
- **No grouping of digits** on the document: the number prints as saved.

## Why only the owner changes them
Changing where customers send money is how invoice fraud happens. Members can read the details (documents show them); admins and staff cannot change them. A sent document keeps what it showed. A step-up re-authentication before a change is listed in `docs/security-notes.md` and not built yet.
