export function createId() {
  if ('randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
    const value = Math.floor(Math.random() * 16);
    const uuidValue = character === 'x' ? value : (value & 0x3) | 0x8;

    return uuidValue.toString(16);
  });
}
