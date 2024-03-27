export const wgslPrelude = `
function silence_sound(duration) {
  return make_sound((_t) => 0, duration);
}

function noise_sound(duration){
  return make_sound((t) => _random() * 2 - 1, duration);
}

function consecutively(list_of_sounds) {
  function consec_two(ss1, ss2) {
    const wave1 = get_wave(ss1);
    const wave2 = get_wave(ss2);
    const dur1 = get_duration(ss1);
    const dur2 = get_duration(ss2);
    const new_wave = (t) => (t < dur1 ? wave1(t) : wave2(t - dur1));
    return make_sound(new_wave, dur1 + dur2);
  }
  return accumulate(consec_two, silence_sound(0), list_of_sounds);
}

function simultaneously(list_of_sounds) {
  function simul_two(ss1, ss2) {
    const wave1 = get_wave(ss1);
    const wave2 = get_wave(ss2);
    const dur1 = get_duration(ss1);
    const dur2 = get_duration(ss2);
    // new_wave assumes sound discipline (ie, wave(t) = 0 after t > dur)
    const new_wave = (t) => wave1(t) + wave2(t);
    // new_dur is higher of the two dur
    const new_dur = dur1 < dur2 ? dur2 : dur1;
    return make_sound(new_wave, new_dur);
  }

  const mushed_sounds = accumulate(simul_two, silence_sound(0), list_of_sounds);
  const normalised_wave = (t) => get_wave(mushed_sounds)(t) / length(list_of_sounds);
  const highest_duration = get_duration(mushed_sounds);
  return make_sound(normalised_wave, highest_duration);
}

function sine_sound(freq, duration) {
  return make_sound((t) => math_sin(2 * math_PI * t * freq), duration);
}

function square_sound(f, duration) {
  const fourier_expansion_square = t => accumulate(
    (x, y) => y + math_sin(2 * math_PI * (2 * x - 1) * f * t) / (2 * x - 1), 
    0, 
    list(1, 2, 3, 4, 5));
  return make_sound((t) => (4 / math_PI) * fourier_expansion_square(t), duration);
}

function linear_decay(decay_period) {
  return (t) => 
  t > decay_period || t < 0
  ? 0
  : 1 - t / decay_period;
}

function adsr(
  attack_ratio,
  decay_ratio,
  sustain_level,
  release_ratio
) {
  return (sound) => {
    const wave = get_wave(sound);
    const duration = get_duration(sound);
    const attack_time = duration * attack_ratio;
    const decay_time = duration * decay_ratio;
    const release_time = duration * release_ratio;
    
    return make_sound((x) => 
      x < attack_time
      ? wave(x) * (x / attack_time)
      : x < attack_time + decay_time
      ? ((1 - sustain_level) * linear_decay(decay_time)(x - attack_time)
            + sustain_level)
          * wave(x)
      : x < duration - release_time
      ? wave(x) * sustain_level
      : wave(x)
          * sustain_level
          * linear_decay(release_time)(x - (duration - release_time))
    , duration);
  };
}

function letter_name_to_frequency(note) {
  return midi_note_to_frequency(letter_name_to_midi_note(note));
}

function letter_name_to_midi_note(note) {
  return note === 'A0' ? 21 :
         note === 'A0#' || note === 'B0b' ? 22 :
         note === 'B0' ? 23 :

         note === 'C1' ? 24 :
         note === 'C1#' || note === 'D1b' ? 25 :
         note === 'D1' ? 26 :
         note === 'D1#' || note === 'E1b' ? 27 :
         note === 'E1' ? 28 :
         note === 'F1' ? 29 :
         note === 'F1#' || note === 'G1b' ? 30 :
         note === 'G1' ? 31 :
         note === 'G1#' || note === 'A1b' ? 32 :
         note === 'A1' ? 33 :
         note === 'A1#' || note === 'B1b' ? 34 :
         note === 'B1' ? 35 :

         note === 'C2' ? 36 :
         note === 'C2#' || note === 'D2b' ? 37 :
         note === 'D2' ? 38 :
         note === 'D2#' || note === 'E2b' ? 39 :
         note === 'E2' ? 40 :
         note === 'F2' ? 41 :
         note === 'F2#' || note === 'G2b' ? 42 :
         note === 'G2' ? 43 :
         note === 'G2#' || note === 'A2b' ? 44 :
         note === 'A2' ? 45 :
         note === 'A2#' || note === 'B2b' ? 46 :
         note === 'B2' ? 47 :

         note === 'C3' ? 48 :
         note === 'C3#' || note === 'D3b' ? 49 :
         note === 'D3' ? 50 :
         note === 'D3#' || note === 'E3b' ? 51 :
         note === 'E3' ? 52 :
         note === 'F3' ? 53 :
         note === 'F3#' || note === 'G3b' ? 54 :
         note === 'G3' ? 55 :
         note === 'G3#' || note === 'A3b' ? 56 :
         note === 'A3' ? 57 :
         note === 'A3#' || note === 'B3b' ? 58 :
         note === 'B3' ? 59 :

         note === 'C4' ? 60 :
         note === 'C4#' || note === 'D4b' ? 61 :
         note === 'D4' ? 62 :
         note === 'D4#' || note === 'E4b' ? 63 :
         note === 'E4' ? 64 :
         note === 'F4' ? 65 :
         note === 'F4#' || note === 'G4b' ? 66 :
         note === 'G4' ? 67 :
         note === 'G4#' || note === 'A4b' ? 68 :
         note === 'A4' ? 69 :
         note === 'A4#' || note === 'B4b' ? 70 :
         note === 'B4' ? 71 :

         note === 'C5' ? 72 :
         note === 'C5#' || note === 'D5b' ? 73 :
         note === 'D5' ? 74 :
         note === 'D5#' || note === 'E5b' ? 75 :
         note === 'E5' ? 76 :
         note === 'F5' ? 77 :
         note === 'F5#' || note === 'G5b' ? 78 :
         note === 'G5' ? 79 :
         note === 'G5#' || note === 'A5b' ? 80 :
         note === 'A5' ? 81 :
         note === 'A5#' || note === 'B5b' ? 82 :
         note === 'B5' ? 83 :

         note === 'C6' ? 84 :
         note === 'C6#' || note === 'D6b' ? 85 :
         note === 'D6' ? 86 :
         note === 'D6#' || note === 'E6b' ? 87 :
         note === 'E6' ? 88 :
         note === 'F6' ? 89 :
         note === 'F6#' || note === 'G6b' ? 90 :
         note === 'G6' ? 91 :
         note === 'G6#' || note === 'A6b' ? 92 :
         note === 'A6' ? 93 :
         note === 'A6#' || note === 'B6b' ? 94 :
         note === 'B6' ? 95 :

         note === 'C7' ? 96 :
         note === 'C7#' || note === 'D7b' ? 97 :
         note === 'D7' ? 98 :
         note === 'D7#' || note === 'E7b' ? 99 :
         note === 'E7' ? 100 :
         note === 'F7' ? 101 :
         note === 'F7#' || note === 'G7b' ? 102 :
         note === 'G7' ? 103 :
         note === 'G7#' || note === 'A7b' ? 104 :
         note === 'A7' ? 105 :
         note === 'A7#' || note === 'B7b' ? 106 :
         note === 'B7' ? 107 :

         note === 'C8' ? 108 : 0;
}

function stacking_adsr(
  waveform,
  base_frequency,
  duration,
  envelopes
) {
  const zip = (lst, n) => 
    is_null(lst)
    ? lst
    : pair(pair(n, head(lst)), zip(tail(lst), n + 1));

  return simultaneously(
    accumulate(
      (x, y) => pair(tail(x)(waveform(base_frequency * head(x), duration)), y),
      null,
      zip(envelopes, 1)
    )
  );
}

function midi_note_to_frequency(note) {
  return 440 * math_pow(2, (note - 69) / 12);
}

function cello(note, duration) {
  return stacking_adsr(
    square_sound,
    midi_note_to_frequency(note),
    duration,
    list(adsr(0.05, 0, 1, 0.1), adsr(0.05, 0, 1, 0.15), adsr(0, 0, 0.2, 0.15))
  );
}

function bell(note, duration) {
  return stacking_adsr(
    square_sound,
    midi_note_to_frequency(note),
    duration,
    list(
      adsr(0, 0.6, 0, 0.05),
      adsr(0, 0.6618, 0, 0.05),
      adsr(0, 0.7618, 0, 0.05),
      adsr(0, 0.9071, 0, 0.05)
    )
  );
}

function phase_mod(freq, duration, amount) {
  return (modulator) => make_sound(
    (t) => math_sin(2 * math_PI * t * freq + amount * get_wave(modulator)(t)),
    duration
  );
}

function triangle_sound(freq, duration) {
  const fourier_expansion_triangle = t => accumulate(
    (x, y) => y + (math_pow(-1, x) * math_sin((2 * x + 1) * t * freq * math_PI * 2))
        / math_pow(2 * x + 1, 2), 
    0, 
    list(1, 2, 3, 4, 5));
  return make_sound(
      (t) => (8 / math_PI / math_PI) * fourier_expansion_triangle(t),
      duration);
}

function piano(note, duration) {
  return stacking_adsr(
    triangle_sound,
    midi_note_to_frequency(note),
    duration,
    list(adsr(0, 0.515, 0, 0.05), adsr(0, 0.32, 0, 0.05), adsr(0, 0.2, 0, 0.05))
  );
}

function play_wave(wave, duration) {
  return play(make_sound(wave, duration));
}

function sawtooth_sound(freq, duration) {
  const fourier_expansion_sawtooth = t => accumulate(
    (x, y) => y +  math_sin(2 * math_PI * x * freq * t) / x, 
    0, 
    list(1, 2, 3, 4, 5));
  return make_sound(
      (t) => 1 / 2 - (1 / math_PI) * fourier_expansion_sawtooth(t),
      duration);
}

function violin(note, duration) {
  return stacking_adsr(
    sawtooth_sound,
    midi_note_to_frequency(note),
    duration,
    list(
      adsr(0.35, 0, 1, 0.15),
      adsr(0.35, 0, 1, 0.15),
      adsr(0.45, 0, 1, 0.15),
      adsr(0.45, 0, 1, 0.15)
    )
  );
}

function trombone(note, duration) {
  return stacking_adsr(
    square_sound,
    midi_note_to_frequency(note),
    duration,
    list(adsr(0.2, 0, 1, 0.1), adsr(0.3236, 0.6, 0, 0.1))
  );
}
`
