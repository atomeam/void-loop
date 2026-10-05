// Test traffic, not people: monitor pings, research probes and keyboard mash. The page answers these with silence
// (void.html "quiet one-liners"); the same list keeps them off the miss board and out of the will, so a probe that
// agents or monitors send is never read as something people want Void to learn.
export const NOISE = /^(?:test|testing|probe|ping|ping-test|pong|hello world test|research probe|test miss(?: from research)?|health ?check|smoke ?test|asdf+|qwerty|zz+q*x*)\s*[.!?]*$|^[bcdfghjklmnpqrstvwxz]{4,8}$|^\/[\w-]+$|^zz+\b.*\bprobe\b|^(?:test|probe)[\s:_-]+\S*$/i;
export const isNoise = (ask) => NOISE.test(String(ask || '').trim());
