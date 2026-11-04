import FuzzyText from './FuzzyText';

// Keep the literal text inside React; Astro slots are rendered HTML, not string children.
export default function NotFoundCode({ text = '404' }: { text?: '404' | 'not found' }) {
  return <FuzzyText
    fontSize="inherit"
    fontWeight={text === '404' ? 700 : 600}
    color="currentColor"
    colorSplit={0}
    trigger="hover"
    direction="horizontal"
    baseIntensity={0.2}
    hoverIntensity={0.5}
    fuzzRange={30}
    sliceSize={1}
    fps={60}
    transitionDuration={0}
    intro
    introDuration={1400}
    letterSpacing={0}
    enableHover
    clickEffect={false}
    glitchMode={false}
    glitchInterval={2000}
    glitchDuration={200}
  >{text}</FuzzyText>;
}
