
/**
 * Makes a Sound with given wave function and duration.
 * The wave function is a function: number -> number
 * that takes in a non-negative input time and returns an amplitude
 * between -1 and 1.
 *
 * @param wave wave function of the Sound
 * @param duration duration of the Sound
 * @return with wave as wave function and duration as duration
 * @example const s = make_sound(t => Math_sin(2 * Math_PI * 440 * t), 5);
 */
function make_sound(wave, duration) {}

/**
 * Accesses the wave function of a given Sound.
 *
 * @param sound given Sound
 * @return the wave function of the Sound
 * @example get_wave(make_sound(t => Math_sin(2 * Math_PI * 440 * t), 5)); // Returns t => Math_sin(2 * Math_PI * 440 * t)
 */
function get_wave(sound) {}

/**
 * Accesses the duration of a given Sound.
 *
 * @param sound given Sound
 * @return the duration of the Sound
 * @example get_duration(make_sound(t => Math_sin(2 * Math_PI * 440 * t), 5)); // Returns 5
 */
function get_duration(sound) {}

/**
 * Checks if the argument is a Sound
 *
 * @param x input to be checked
 * @return true if x is a Sound, false otherwise
 * @example is_sound(make_sound(t => 0, 2)); // Returns true
 */
function is_sound(x) {}

/**
 * Plays the given Wave using the computer’s sound device, for the duration
 * given in seconds.
 *
 * @param wave the wave function to play, starting at 0
 * @return the resulting Sound
 * @example play_wave(t => math_sin(t * 3000), 5);
 */
function play_wave(wave, duration) {}

/**
 * Plays the given Sound using the computer’s sound device
 * on top of any Sounds that are currently playing.
 *
 * @param sound the Sound to play
 * @return the given Sound
 * @example play(sine_sound(440, 5));
 */
function play(sound) {}

/**
 * Makes a noise Sound with given duration
 *
 * @param duration the duration of the noise sound
 * @return resulting noise Sound
 * @example noise_sound(5);
 */
function noise_sound(duration) {}

/**
 * Makes a silence Sound with given duration
 *
 * @param duration the duration of the silence Sound
 * @return resulting silence Sound
 * @example silence_sound(5);
 */
function silence_sound(duration) {}

/**
 * Makes a sine wave Sound with given frequency and duration
 *
 * @param freq the frequency of the sine wave Sound
 * @param duration the duration of the sine wave Sound
 * @return resulting sine wave Sound
 * @example sine_sound(440, 5);
 */
function sine_sound(freq, duration) {}

/**
 * Makes a square wave Sound with given frequency and duration
 *
 * @param freq the frequency of the square wave Sound
 * @param duration the duration of the square wave Sound
 * @return resulting square wave Sound
 * @example square_sound(440, 5);
 */
function square_sound(freq, duration) {}

/**
 * Makes a triangle wave Sound with given frequency and duration
 *
 * @param freq the frequency of the triangle wave Sound
 * @param duration the duration of the triangle wave Sound
 * @return resulting triangle wave Sound
 * @example triangle_sound(440, 5);
 */
function triangle_sound(freq, duration) {}

/**
 * Makes a sawtooth wave Sound with given frequency and duration
 *
 * @param freq the frequency of the sawtooth wave Sound
 * @param duration the duration of the sawtooth wave Sound
 * @return resulting sawtooth wave Sound
 * @example sawtooth_sound(440, 5);
 */
function sawtooth_sound(freq, duration) {}

/**
 * Makes a new Sound by combining the sounds in a given list
 * where the second Sound is appended to the end of the first Sound,
 * the third Sound is appended to the end of the second Sound, and
 * so on. The effect is that the Sounds in the list are joined end-to-end
 *
 * @param list_of_sounds given list of Sounds
 * @return the combined Sound
 * @example consecutively(list(sine_sound(200, 2), sine_sound(400, 3)));
 */
function consecutively(list_of_sounds) {}

/**
 * Makes a new Sound by combining the Sounds in a given list
 * where all the Sounds are overlapped on top of each other.
 *
 * @param list_of_sounds given list of Sounds
 * @return the combined Sound
 * @example simultaneously(list(sine_sound(200, 2), sine_sound(400, 3)));
 */
function simultaneously(list_of_sounds) {}

/**
 * Makes a Sound transformer that transforms a Sound by applying an ADSR
 * envelope specified by four ratio parameters. All four ratios are between 0 and 1,
 * and their sum is equal to 1.
 *
 * @param attack_ratio the ratio of the duration of the attack phase
 * @param decay_ratio the ratio of the duration of the decay phase
 * @param sustain_level the amplitude level of the sustain phase
 * @param release_ratio the ratio of the duration of the release phase
 * @return the resulting Sound transformer
 * @example adsr(0.1, 0.2, 0.7, 0.1)(sine_sound(440, 5));
 */
function adsr(attack_ratio, decay_ratio, sustain_level, release_ratio) {}

/**
 * Returns a Sound that results from applying a list of envelopes
 * to a given wave form. The wave form is a Sound generator that
 * takes a frequency and a duration as arguments and produces a
 * Sound with the given frequency and duration. Each envelope is
 * applied to a harmonic: the first harmonic has the given frequency,
 * the second has twice the frequency, the third three times the
 * frequency etc. The harmonics are then layered simultaneously to
 * produce the resulting Sound.
 * @param waveform function from pair(frequency, duration) to Sound
 * @param base_frequency frequency of the first harmonic
 * @param duration duration of the produced Sound, in seconds
 * @param envelopes – list of envelopes, which are functions from Sound to Sound
 * @return Sound resulting Sound
 * @example stacking_adsr(sine_sound, 300, 5, list(adsr(0.1, 0.3, 0.2, 0.5), adsr(0.2, 0.5, 0.6, 0.1), adsr(0.3, 0.1, 0.7, 0.3)));
 */
function stacking_adsr(waveform, base_frequency, duration, envelopes) {}

/**
 * Returns a Sound transformer which uses its argument
 * to modulate the phase of a (carrier) sine wave
 * of given frequency and duration with a given Sound.
 * Modulating with a low frequency Sound results in a vibrato effect.
 * Modulating with a Sound with frequencies comparable to
 * the sine wave frequency results in more complex wave forms.
 *
 * @param freq the frequency of the sine wave to be modulated
 * @param duration the duration of the output Sound
 * @param amount the amount of modulation to apply to the carrier sine wave
 * @return function which takes in a Sound and returns a Sound
 * @example phase_mod(440, 5, 1)(sine_sound(220, 5));
 */
function phase_mod(freq, duration, amount) {}

/**
 * Converts a letter name to its corresponding MIDI note.
 * The letter name is represented in standard pitch notation.
 * Examples are "A5", "Db3", "C#7".
 *
 * @param letter_name given letter name
 * @return the corresponding midi note
 * @example letter_name_to_midi_note("C4"); // Returns 60
 */
function letter_name_to_midi_note(note) {}

/**
 * Converts a MIDI note to its corresponding frequency.
 *
 * @param note given MIDI note
 * @return the frequency of the MIDI note
 * @example midi_note_to_frequency(69); // Returns 440
 */
function midi_note_to_frequency(note) {}

/**
 * Converts a letter name to its corresponding frequency.
 *
 * @param letter_name given letter name
 * @return the corresponding frequency
 * @example letter_name_to_frequency("A4"); // Returns 440
 */
function letter_name_to_frequency(note) {}

/**
 * returns a Sound reminiscent of a bell, playing
 * a given note for a given duration
 * @param note MIDI note
 * @param duration duration in seconds
 * @return Sound resulting bell Sound with given pitch and duration
 * @example bell(40, 1);
 */
function bell(note, duration) {}

/**
 * returns a Sound reminiscent of a cello, playing
 * a given note for a given duration
 * @param note MIDI note
 * @param duration duration in seconds
 * @return Sound resulting cello Sound with given pitch and duration
 * @example cello(36, 5);
 */
function cello(note, duration) {}

/**
 * returns a Sound reminiscent of a piano, playing
 * a given note for a given duration
 * @param note MIDI note
 * @param duration duration in seconds
 * @return Sound resulting piano Sound with given pitch and duration
 * @example piano(48, 5);
 */
function piano(note, duration) {}

/**
 * returns a Sound reminiscent of a trombone, playing
 * a given note for a given duration
 * @param note MIDI note
 * @param duration duration in seconds
 * @return Sound resulting trombone Sound with given pitch and duration
 * @example trombone(60, 2);
 */
function trombone(note, duration) {}

/**
 * returns a Sound reminiscent of a violin, playing
 * a given note for a given duration
 * @param note MIDI note
 * @param duration duration in seconds
 * @return Sound resulting violin Sound with given pitch and duration
 * @example violin(53, 4);
 */
function violin(note, duration) {}
