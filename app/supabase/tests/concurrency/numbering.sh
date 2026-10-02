#!/usr/bin/env bash
# Many database connections ask for document numbers at the same moment. Every number must
# be handed out exactly once, in a gapless run. This commits real rows (so connections can
# race), then removes them. Usage: numbering.sh <database url>
set -euo pipefail

url="${1:?usage: numbering.sh <database url>}"
parallel=30
psql_q() { psql -v ON_ERROR_STOP=1 -qAtX "$url" "$@"; }

org="$(psql_q -c "insert into public.organisations (name) values ('Concurrency test') returning id" | head -n1)"
cleanup() { psql_q -c "delete from public.organisations where id = '$org'" >/dev/null || true; }
trap cleanup EXIT

work="$(mktemp -d)"
for i in $(seq 1 "$parallel"); do
  ( psql_q -c "select public.issue_document_number('$org', 'quote')" > "$work/$i.out" 2> "$work/$i.err" ) &
done
wait

failed=0
for i in $(seq 1 "$parallel"); do
  [[ -s "$work/$i.out" ]] || { echo "connection $i got no number: $(cat "$work/$i.err")"; failed=1; }
done
[[ "$failed" -eq 0 ]] || exit 1

got="$(cat "$work"/*.out | sort)"
expected="$(for i in $(seq 1 "$parallel"); do printf 'QT-%04d\n' "$i"; done | sort)"
if [[ "$got" != "$expected" ]]; then
  echo "numbers were not unique and gapless"; echo "got:"; echo "$got"; exit 1
fi
rm -rf "$work"
echo "document numbering concurrency test passed ($parallel connections)"
