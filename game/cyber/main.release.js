// This is the entry point for the release build. All we do is import the
// ordinary main entry point, but using this module as the entry point means
// that the bundled script has no exports, doesn't need to create a global, and
// is slightly smaller as a result.
import '/game/cyber/main';
