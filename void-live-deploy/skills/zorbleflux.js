export const name = 'zorbleflux';
export const families = ['Verse itself', 'Safety and small delights'];
export const patterns = [/(what is|tell me about) zorbleflux/i, /zorbleflux throttle/i];
export async function handle({ message }) {
  return {
    card: {
      title: 'Zorbleflux Throttle',
      content: 'Zorbleflux is a core mechanic of the Verse stage that prevents high-frequency input from creating visual noise. When too many nodes or interactions are spawned rapidly, the throttle activates, gracefully queuing inputs to maintain the spatial harmony of the 3D starfield.'
    }
  };
}
