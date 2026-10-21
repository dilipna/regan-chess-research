# AI security finding template

Copy this for each finding from an authorized, sandboxed test.

_Generated from the LatentLens curriculum data (apps/web/src/lib/latent). Edit the data, then regenerate; do not edit by hand._

## Title

_Component, failure and consequence in one line, e.g. "Calendar invites can trigger unapproved transfers"._

## Summary

_Two or three sentences a non-specialist can act on._

## Affected component

_Service, tool, model version and configuration._

## Prerequisites

_What the attacker needs: position (user, document author, server operator), access, timing._

## Threat model

_Assets at risk, trust boundary crossed, attacker capability._

## Reproduction in sandbox

_Exact fixed inputs, configuration, model and decoding settings, and number of trials._

## Observed behavior

_What the system did, with the success rate over repeated trials._

## Expected behavior

_What a secure system should have done._

## Impact

_Effect on confidentiality, integrity or availability of named assets._

## Severity rationale

_Impact on assets, attacker position and prerequisites, reliability (success rate), existing mitigations._

## Evidence

_Logs, transcripts and configuration from the sandbox run; fake data only._

## Root cause

_The design assumption that failed (for example: untrusted content can choose tool arguments)._

## Recommended mitigation

_Architecture-level control first (permissions, validation, approval), then likelihood reductions._

## Regression test

_The automated case that must fail before the fix and pass after._

## Residual risk

_What the fix does not cover._
