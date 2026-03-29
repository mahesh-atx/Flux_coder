// index.tsx — Entry point for Flux TUI
import { render } from "@opentui/solid"
import App from "./app"

// render() takes a Solid component factory and optional renderer config
await render(() => <App />, {
  targetFps: 60,
  exitOnCtrlC: false,
  autoFocus: false,
})