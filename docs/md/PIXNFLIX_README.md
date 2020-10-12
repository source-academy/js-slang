The PIXNFLIX library allows us to process still images and video.
Each Image is a two-dimensional array of Pixels, and a Pixel
consists of red, blue and green color values, each ranging from
0 and 255. To access these color values of a Pixel, we provide the
functions `red_of`, `blue_of` and `green_of`.

A central element of PIXNFLIX is the notion of a *Filter*, 
a function that is applied to two images: 
the source Image and the destination Image. We can *install*
a given Filter to be used to transform
the Images that the camera captures into images
displayed on the output screen by using the function `install_filter`.
The output screen is shown in the Source Academy in the tab with
the "Video Display" icon (camera).

The size of the output screen can be changed by the user. To access
the current size of the output screen, we provide the functions
`video_height` and `video_width`.
