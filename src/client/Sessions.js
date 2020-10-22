import Session from './Session';

class Sessions {
  constructor(como) {
    this.como = como;
  }

  observe(callback) {
    // @note - we need this convoluted stuff because the state itself is created
    // before the `sessionOverview` is updated (maybe this could be cleaned up
    // with  reducers, but not completely sure...).
    // anyway, we probably need a real simple solution for this kind of problems
    const sessionsOverview = this.como.project.get('sessionsOverview');
    // the initialisation step is the more tricky...
    const createdStateIds = new Set(sessionsOverview.map(s => s.stateId));
    const notifiedStateIds = new Set();

    const notifySessionCreation = () => {
      const sessionsOverview = this.como.project.get('sessionsOverview');

      createdStateIds.forEach(stateId => {
        sessionsOverview.forEach(overview => {
          if (overview.stateId === stateId) {
            notifiedStateIds.add(stateId);
            createdStateIds.delete(stateId);

            callback(overview.id);
          }
        });
      });
    }

    const unobserve = this.como.client.stateManager.observe((schemaName, stateId, nodeId) => {
      if (schemaName === 'session') {
        // if the session has not been notified at initialization step
        if (!notifiedStateIds.has(stateId)) {
          createdStateIds.add(stateId);
        }
      }
    });

    const unsubscribe = this.como.project.subscribe(updates => {
      if ('sessionsOverview' in updates) {
        notifySessionCreation();
      }
    });

    // notify with already existing sessions
    notifySessionCreation();

    return unsubscribe;
  }

  async attach(sessionId) {
    const sessionsOverview = this.como.project.get('sessionsOverview');
    const overview = sessionsOverview.find(s => s.id === sessionId);

    if (overview) {
      const sessionState = await this.como.client.stateManager.attach(`session`, overview.stateId);
      const session = new Session(this.como, sessionState);
      await session.init();

      return session;
    } else {
      return null;
    }
  }
}

export default Sessions;
