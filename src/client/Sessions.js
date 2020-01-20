import Session from './Session';

class Sessions {
  constructor(como) {
    this.como = como;
    this._list = new Map();
  }

  observe(callback) {
    let createdStateId = null;

    // @note - we need to do that because the state itself is created before
    // the overview is updated, so we need to wait for the overview update.
    const unobserve = this.como.client.stateManager.observe((schemaName, stateId, nodeId) => {
      if (schemaName === 'session') {
        callback(stateId);
      }
    });
  }

  async attach(stateId) {
    const sessionState = await this.como.client.stateManager.attach(`session`, stateId);
    const session = new Session(this.como, sessionState);
    await session.updateAudioFiles();

    sessionState.subscribe(updates => {
      for (let name in updates) {
        switch (name) {
          case 'audioFiles': {
            session.updateAudioFiles();
            break;
          }
        }
      }
    });

    return session;
  }

  /**
   * helper function
   */
  getStateId(sessionId) {
    const sessionsOverview = this.como.project.get('sessionsOverview');
    const stateId = sessionsOverview.find(s => s.id === sessionId).stateId;
    return stateId;
  }
}

export default Sessions;
