
export default class AbstractSource {
  #como;
  #state;

  constructor(como) {
    this.#como = como;
  }

  init(state) {
    this.#state = state;
  }

  get id() {
    throw new Error(`AbstractSource.id must be implemented in child class`);
  }

  get como() {
    return this.#como;
  }

  get state() {
    return this.#state;
  }
}
