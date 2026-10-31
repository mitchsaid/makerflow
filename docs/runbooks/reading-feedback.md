# Reading feedback

What makers send with **Send feedback** (`docs/plans/feedback-button.md`) is kept in the `feedback` table. The app can write to it and nothing in the app can read it, so you read it where you run the database.

## On a hosted project (dev or production)
Open the Supabase dashboard for the project, then **SQL editor**, and run:

```sql
select f.created_at, o.name as business, f.kind, f.message, f.page, f.viewport, f.user_agent, f.contact_email
  from public.feedback f
  join public.organisations o on o.id = f.organisation_id
 order by f.created_at desc
 limit 50;
```

The SQL editor runs as the database owner, so it sees every business's feedback (that is why it is read here and not in the app).

## On your own computer (local stack)
```bash
docker exec supabase_db_app psql -U postgres -c "select created_at, kind, left(message, 80) as message, page from public.feedback order by created_at desc limit 20;"
```

## Replying
Reply only to `contact_email` where it is filled in: it is the account's own address and the person ticked "You can email me about this". Where it is empty, they asked not to be contacted.

## Looking after it
- It holds people's words and some of their email addresses: do not paste it into other tools or share the table. A person's account being deleted clears their `user_id` and `contact_email` on the row (a trigger) and keeps the message.
- Nothing arrives as a notification yet (there is no sending domain). Look at it daily during a test.
