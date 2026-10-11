import { Component } from 'react';
import type { ReactNode } from 'react';

/** Any render error inside the children calls onError and renders nothing, so a 3D problem never crashes the screen. */
export class Boundary extends Component<{ onError: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onError();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}
