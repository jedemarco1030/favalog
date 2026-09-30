#!/usr/bin/env bash
set -euo pipefail

# Runner-local diagnostics only: never inspect container env or application keys,
# and never kill an unknown listener or remove another project's containers.
diagnose() {
  printf '\nLocal Supabase port owners (54320-54329):\n'
  sudo ss -ltnp '( sport >= :54320 and sport <= :54329 )' || true
  sudo lsof -nP -iTCP:54324 -sTCP:LISTEN || true
  printf '\nLocal email port TCP states (including non-listening sockets):\n'
  sudo ss -tanp '( sport = :54324 or dport = :54324 )' || true
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

# The stack's ports overlap Linux's ephemeral range. Reserve them BEFORE image
# pulls so outbound connections cannot claim a port Docker has yet to bind.
# Keep existing reservations; do not change developer machines or kill listeners.
if [[ "${GITHUB_ACTIONS:-}" == "true" ]]; then
  reserved_ports="$(sysctl -n net.ipv4.ip_local_reserved_ports)"
  sudo sysctl -w "net.ipv4.ip_local_reserved_ports=${reserved_ports:+${reserved_ports},}54320-54329"
fi

diagnose
npx supabase start
