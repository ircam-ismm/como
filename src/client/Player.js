
class Player {
  constructor(playerState) {
    this.state = playerState;
  }

  // we should have a parent class or a mixin to avoid repeting that...
  getValues() {
    return this.state.getValues();
  }

  get(name) {
    return this.state.get(name);
  }

  async set(values) {
    return await this.state.set(values);
  }

  subscribe(func, executeListener) {
    return this.state.subscribe(func, executeListener);
  }

  async detach() {
    await this.state.detach();
  }

  onDetach(func) {
    this.state.onDetach(func);
  }

  onDelete(func) {
    this.state.onDelete(func);
  }

  // "real" specific player code
  setGraphOptions(moduleId, updates) {
    this.state.set({ graphOptionsEvent: { [moduleId]: updates }});
  }

  getGraphOptions(moduleId) {
    graphOptions = this.state.get('graphOptions');
    return graphOptions[moduleId];
  }
}

export default Player;
