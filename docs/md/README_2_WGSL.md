Source §2 WGSL is a small programming language, designed for the second chapter
of the textbook
<a href="https://sourceacademy.org/sicpjs">Structure and Interpretation
of Computer Programs, JavaScript Adaptation</a> (SICP JS).

## What names are predeclared in Source §2 WGSL?

On the right, you see all predeclared names of Source §2 WGSL, in alphabetical
order. Click on a name to see how it is defined and used. They come in
these groups:
  <ul>
    <li>
      <a href="../AUXILIARY/">AUXILIARY</a>: Auxiliary constants and functions
    </li>
    <li>
      <a href="../MISC/">MISC</a>: Miscellaneous constants and functions
    </li>
    <li>
      <a href="../MATH/">MATH</a>: Mathematical constants and functions
    </li>
    <li>
      <a href="../LISTS/">LISTS</a>: Support for lists
    </li>
    <li>
      <a href="../SOUNDS_GPU/">SOUNDS_GPU</a>: Support for sound module (GPU version)
    </li>
  </ul>

## What is WGSL?

WGSL stands for WebGPU Shading Language. It is the language used for writing programs that run on the GPU for web applications using the WebGPU API. It is designed to be safe, easy to use, and works across different web browsers and devices. WGSL thus allows us to write code that accelerates computations and graphics processing for web applications.

## What can you do in Source §2 WGSL?

You can use all features of
<a href="../source_2/">Source §2</a>, but with the enhanced performance of functions in the <a href="https://source-academy.github.io/modules/documentation/modules/sound.html">sound module</a>. 
These functions are readily available for use without the need for explicit imports. 
However, please note that the functions 'init_record', 'play_in_tab', 'record', 'record for', 'stop' are not available in this context. For a list of supported module functions, consult the <a href="../SOUNDS_GPU">SOUNDS_GPU documentation</a>.
In the event that your code encounters issues when running on the GPU, the program will automatically switch to running on the CPU. A prompt will be displayed to inform you of this change.

## Which browser should you use?

For the best experience with WebGPU, use the most recent versions of Chrome, Edge, or Opera, with Chrome being the preferred option. Please be aware that Safari and Firefox currently do not support WebGPU.

## You want the definitive specs?

For our development team, we are maintaining a definitive description
of the language, called the
<a href="../source_2_wgsl.pdf">Specification of Source §2 WGSL</a>. Feel free to
take a peek!


