# FairPath Forms + Filing

Record Relief is the first use case for a reusable forms engine.

## Safety boundary
A filing is enabled only from a verified jurisdiction rule and official/authorized form source. Store source, effective date, verification date, signature requirement, allowed filing methods, court fee and fee-waiver information. If a current rule or method is not verified, show review required rather than guessing.

## Flow
Eligibility result -> official form selection -> canonical profile autofill -> missing questions -> user confirmation -> PDF generation -> signature requirement -> DIY export/share OR supported fulfillment -> tracking -> court response status.

## Free
Eligibility result, countdown when supported, official forms/instructions, filing checklist, DIY download/share.

## FairPath+
Mobile/web form filler, canonical autofill, saved drafts, document vault, field explanations, reusable forms workspace and filing tracker.

## Transactional filing service
Optional separate charge. Quote service fee, postage and court fee separately. Do not hard-code a retail price until fulfillment costs and jurisdiction requirements are validated.

## Integrations
Adapters should be provider-neutral:
- e-sign adapter
- payment adapter
- transactional email/share adapter
- print/mail fulfillment adapter
- postal address validation/tracking adapter
- court e-filing adapter where authorized and technically supported

Never show an integration as live until credentials, authorization, error handling and end-to-end tests are complete.

## Status
draft -> ready_for_review -> needs_signature -> ready_to_file -> submitted_to_mail -> mailed -> delivered -> court_response_pending -> complete
