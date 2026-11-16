# Architecture rules
- Statistics questions run inside the existing stats-report function after its admin/password authorization, using a freshly generated report only; this keeps shared access limited to the same statistics and avoids exposing unrelated personal records.
- Render AI answers as sanitized Markdown without raw HTML; this supports readable tables without executing generated markup.