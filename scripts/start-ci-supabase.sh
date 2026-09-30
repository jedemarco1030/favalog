#!/usr/bin/env bash
set -euo pipefail

# Runner-local diagnostics only: never inspect container env or application keys,
# and never kill an unknown listener or remove another project's containers.
diagnose() {
  printf '\nLocal Supabase port owners (54320-54329):\n'
  sudo ss -ltnp '( sport >= :54320 and sport <= :54329 )' || true
  sudo lsof -nP -iTCP:54324 -sTCP:LISTEN || true
  docker ps -a --format '{{.Names}}\t{{.Status}}\t{{.Ports}}' || true
}

on_exit() {
  local status=$?
  if (( status != 0 )); then
    diagnose
    printf '%s\n' '::error::Local Supabase setup failed; tests not executed. See port-owner diagnostics above.'
    if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
      printf '%s\n' 'Local Supabase setup failed: **tests not executed**. No automatic retry or listener termination was performed.' >> "$GITHUB_STEP_SUMMARY"
    fi
  fi
  exit "$status"
}
trap on_exit EXIT

diagnose
npx supabase start
