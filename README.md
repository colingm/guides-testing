# guides-sim data

Backup of the visitor roster used by the simulator on `colingm/guides-sim-testing` (`visitor-sim/`).
`visitors.json` holds **fake** visitors only: fake emails (@example.com), fake plaintext passwords,
and the visitor/workspace ids the Halo app generated at signup (these are what Pendo sees).

The scheduled cloud agent keeps this file in sync with the roster in its prompt after each run.
No application code lives on this branch.
