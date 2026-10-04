#!/usr/bin/env sh
# Rebuilds supabase/setup.sql (one file to paste into the Supabase SQL editor)
cd "$(dirname "$0")/.." || exit 1
{
  echo "-- DocuSend database setup: paste this whole file into Supabase → SQL Editor → Run."
  echo "-- Generated from supabase/migrations by scripts/bundle-sql.sh. Don't edit by hand."
  echo
  for f in supabase/migrations/*.sql; do echo "-- ═══ $(basename "$f") ═══"; cat "$f"; echo; done
} > supabase/setup.sql
