
export default class AbstractSource {
  #como;
  #state;

  constructor(como) {
    this.#como = como;
  }

  get id() {
    return this.#state.get('id');
  }

  get como() {
    return this.#como;
  }

  get state() {
    return this.#state;
  }

  init(state) {
    this.#state = state;
  }

  async delete() {}
}
