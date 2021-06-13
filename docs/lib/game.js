
  /**
   * Transforms the given list into config object. The list follows
   * the format of list([key1, value1], [key2, value2]).
   *
   * e.g list(["alpha", 0], ["duration", 1000])
   *
   * @param {list} lst the list to be turned into config object.
   * @returns {config} config object
   */
  function create_config(lst) {
    const config = {};
    map((xs) => {
      if (!is_pair(xs)) {
        throw_error(`xs is not pair!`);
      }
      config[head(xs)] = tail(xs);
    }, lst);

    return config;
  }

  /**
   * Create text config object, can be used to stylise text object.
   *
   * font_family: for available font_family, see:
   * https://developer.mozilla.org/en-US/docs/Web/CSS/font-family#Valid_family_names
   *
   * align: must be either 'left', 'right', 'center', or 'justify'
   *
   * For more details about text config, see:
   * https://photonstorm.github.io/phaser3-docs/Phaser.Types.GameObjects.Text.html#.TextStyle
   *
   * @param {string} font_family font to be used
   * @param {string} font_size size of font, must be appended with 'px' e.g. '16px'
   * @param {string} color colour of font, in hex e.g. '#fff'
   * @param {string} stroke colour of stroke, in hex e.g. '#fff'
   * @param {number} stroke_thickness thickness of stroke
   * @param {number} align text alignment
   * @returns {config} text config
   */
  function create_text_config(
    font_family = "Courier",
    font_size = "16px",
    color = "#fff",
    stroke = "#fff",
    stroke_thickness = 0,
    align = "left"
  ) {
    const lst = list(
      ["fontFamily", font_family],
      ["fontSize", font_size],
      ["color", color],
      ["stroke", stroke],
      ["strokeThickness", stroke_thickness],
      ["align", align]
    );
    return create_config(lst);
  }

  /**
   * Create interactive config object, can be used to configure interactive settings.
   *
   * For more details about interactive config object, see:
   * https://photonstorm.github.io/phaser3-docs/Phaser.Types.Input.html#.InputConfiguration
   *
   * @param {boolean} draggable object will be set draggable
   * @param {boolean} use_hand_cursor if true, pointer will be set to 'pointer' when a pointer is over it
   * @param {boolean} pixel_perfect pixel perfect function will be set for the hit area. Only works for texture based object
   * @param {number} alpha_tolerance if pixel_perfect is set, this is the alpha tolerance threshold value used in the callback
   * @returns {config} interactive config
   */
  function create_interactive_config(
    draggable = false,
    use_hand_cursor = false,
    pixel_perfect = false,
    alpha_tolerance = 1
  ) {
    const lst = list(
      ["draggable", draggable],
      ["useHandCursor", use_hand_cursor],
      ["pixelPerfect", pixel_perfect],
      ["alphaTolerance", alpha_tolerance]
    );
    return create_config(lst);
  }

  /**
   * Create sound config object, can be used to configure sound settings.
   *
   * For more details about sound config object, see:
   * https://photonstorm.github.io/phaser3-docs/Phaser.Types.Sound.html#.SoundConfig
   *
   * @param {boolean} mute whether the sound should be muted or not
   * @param {number} volume value between 0(silence) and 1(full volume)
   * @param {number} rate the speed at which the sound is played
   * @param {number} detune detuning of the sound, in cents
   * @param {number} seek position of playback for the sound, in seconds
   * @param {boolean} loop whether or not the sound should loop
   * @param {number} delay time, in seconds, that elapse before the sound actually starts
   * @returns {config} sound config
   */
  function create_sound_config(
    mute = false,
    volume = 1,
    rate = 1,
    detune = 0,
    seek = 0,
    loop = false,
    delay = 0
  ) {
    const lst = list(
      ["mute", mute],
      ["volume", volume],
      ["rate", rate],
      ["detune", detune],
      ["seek", seek],
      ["loop", loop],
      ["delay", delay]
    );
    return create_config(lst);
  }

  /**
   * Create tween config object, can be used to configure tween settings.
   *
   * For more details about tween config object, see:
   * https://photonstorm.github.io/phaser3-docs/Phaser.Types.Tweens.html#.TweenBuilderConfig
   *
   * @param {string} target_prop target to tween, e.g. x, y, alpha
   * @param {string | number} target_value the property value to tween to
   * @param {number} delay time in ms/frames before tween will start
   * @param {number} duration duration of tween in ms/frames, exclude yoyos or repeats
   * @param {Function | string} ease ease function to use, e.g. 'Power0', 'Power1', 'Power2'
   * @param {Function} on_complete function to execute when tween completes
   * @param {boolean} yoyo if set to true, once tween complete, reverses the values incrementally to get back to the starting tween values
   * @param {number} loop number of times the tween should loop, or -1 to loop indefinitely
   * @param {number} loop_delay The time the tween will pause before starting either a yoyo or returning to the start for a repeat
   * @param {Function} on_loop function to execute each time the tween loops
   * @returns {config} tween config
   */
  function create_tween_config(
    target_prop = "x",
    target_value = 0,
    delay = 0,
    duration = 1000,
    ease = "Power0",
    on_complete = null_fn,
    yoyo = false,
    loop = 0,
    loop_delay = 0,
    on_loop = null_fn
  ) {
    const lst = list(
      [target_prop, target_value],
      ["delay", delay],
      ["duration", duration],
      ["ease", ease],
      ["onComplete", on_complete],
      ["yoyo", yoyo],
      ["loop", loop],
      ["loopDelay", loop_delay],
      ["onLoop", on_loop]
    );
    return create_config(lst);
  }

  /**
   * Create anims config, can be used to configure anims
   *
   * For more details about the config object, see:
   * https://photonstorm.github.io/phaser3-docs/Phaser.Types.Animations.html#.Animation
   *
   * @param {string} anims_key key that the animation will be associated with
   * @param {list_of_config} anim_frames data used to generate the frames for animation
   * @param {number} frame_rate frame rate of playback in frames per second
   * @param {number} duration how long the animation should play in seconds.
   *                     If null, will be derived from frame_rate
   * @param {number} repeat number of times to repeat the animation, -1 for infinity
   * @param {boolean} yoyo should the animation yoyo (reverse back down to the start)
   * @param {boolean} show_on_start should the sprite be visible when the anims start?
   * @param {boolean} hide_on_complete should the sprite be not visible when the anims finish?
   * @returns {config} anim config
   */
  function create_anim_config(
    anims_key,
    anim_frames,
    frame_rate = 24,
    duration = null,
    repeat = -1,
    yoyo = false,
    show_on_start = true,
    hide_on_complete = false
  ) {
    // Convert from list to array
    const anim_frames_arr = [];
    map((xs) => anim_frames_arr.push(xs), anim_frames);

    const lst = list(
      ["key", anims_key],
      ["frames", anim_frames_arr],
      ["frameRate", frame_rate],
      ["duration", duration],
      ["repeat", repeat],
      ["yoyo", yoyo],
      ["showOnStart", show_on_start],
      ["hideOnComplete", hide_on_complete]
    );
    return create_config(lst);
  }










  /**
   * Create animation frame config, can be used to configure a specific frame
   * within an animation.
   *
   * The key should refer to an image that is already loaded.
   * To make frame_config from spritesheet based on its frames,
   * use create_anim_spritesheet_frame_configs instead.
   *
   * @param {string} key key that is associated with the sprite at this frame
   * @param {string | number} frame either index or string, of the frame
   * @param {number} duration duration, in ms, of this frame of the animation
   * @param {boolean} visible should the parent object be visible during this frame?
   * @returns {config} anim frame config
   */
  function create_anim_frame_config(key, duration = 0, visible = true) {
    const lst = list(
      ["key", key],
      ["duration", duration],
      ["visible", visible]
    );
    return create_config(lst);
  }

  /**
   * Create list of animation frame config, can be used directly as part of 
   * anim_config's `frames` parameter.
   * 
   * This function will generate list of frame configs based on the 
   * spritesheet_config attached to the associated spritesheet.

   * This function requires that the given key is a spritesheet key
   * i.e. a key associated with loaded spritesheet, loaded in using
   * load_spritesheet function.
   * 
   * Will return empty frame configs if key is not associated with
   * a spritesheet.
   *  
   * @param {string} key key associated with spritesheet 
   * @returns {list_of_configs}
   */
  function create_anim_spritesheet_frame_configs(key) {
    if (preload_spritesheet_map.get(key)) {
      const config_arr = scene.anims.generateFrameNumbers(key, {});

      // Convert from array to js-slang list
      const config_lst = build_list(config_arr.length, (id) => config_arr[id]);
      return config_lst;
    } else {
      throw_error(`${key} is not associated with any spritesheet`);
    }
  }

  /**
   * Create spritesheet config, can be used to configure the frames within the
   * spritesheet. Can be used as config at load_spritesheet.
   *
   * @param {number} frame_width width of frame in pixels
   * @param {number} frame_height height of frame in pixels
   * @param {number} start_frame first frame to start parsing from
   * @param {number} margin margin in the image; this is the space around the edge of the frames
   * @param {number} spacing the spacing between each frame in the image
   * @returns {config} spritesheet config
   */
  function create_spritesheet_config(
    frame_width,
    frame_height,
    start_frame = 0,
    margin = 0,
    spacing = 0
  ) {
    const lst = list(
      ["frameWidth", frame_width],
      ["frameHeight", frame_height],
      ["startFrame", start_frame],
      ["margin", margin],
      ["spacing", spacing]
    );
    return create_config(lst);
  }

  ///////////////////////////
  //        SCREEN         //
  ///////////////////////////

  /**
   * Get in-game screen width.
   *
   * @return {number} screen width
   */
  function get_screen_width() {
    return screen_size.x;
  }

  /**
   * Get in-game screen height.
   *
   * @return {number} screen height
   */
  function get_screen_height() {
    return screen_size.y;
  }

  /**
   * Get game screen display width (accounting window size).
   *
   * @return {number} screen display width
   */
  function get_screen_display_width() {
    return scene.scale.displaySize.width;
  }

  /**
   * Get game screen display height (accounting window size).
   *
   * @return {number} screen display height
   */
  function get_screen_display_height() {
    return scene.scale.displaySize.height;
  }

  ///////////////////////////
  //          LOAD         //
  ///////////////////////////

  /**
   * Load the image asset into the scene for use. All images
   * must be loaded before used in create_image.
   *
   * @param {string} key key to be associated with the image
   * @param {string} url path to the image
   */
  function load_image(key, url) {
    preload_image_map.set(key, url);
  }

  /**
   * Load the sound asset into the scene for use. All sound
   * must be loaded before used in play_sound.
   *
   * @param {string} key key to be associated with the sound
   * @param {string} url path to the sound
   */
  function load_sound(key, url) {
    preload_sound_map.set(key, url);
  }

  /**
   * Load the spritesheet into the scene for use. All spritesheet must
   * be loaded before used in create_image.
   *
   * @param {string} key key associated with the spritesheet
   * @param {string} url path to the sound
   * @param {config} spritesheet_config config to determines frames within the spritesheet
   */
  function load_spritesheet(key, url, spritesheet_config) {
    preload_spritesheet_map.set(key, [url, spritesheet_config]);
  }

  ///////////////////////////
  //          ADD          //
  ///////////////////////////

  /**
   * Add the object to the scene. Only objects added to the scene
   * will appear.
   *
   * @param {Phaser.GameObjects.GameObject} obj game object to be added
   */
  function add(obj) {
    if (is_any_type(obj, obj_types)) {
      scene.add.existing(get_obj(obj));
      return obj;
    } else {
      throw_error(`${obj} is not of type ${obj_types}`);
    }
  }

  ///////////////////////////
  //         SOUND         //
  ///////////////////////////

  /**
   * Play the sound associated with the key.
   * Throws error if key is nonexistent.
   *
   * @param {string} key key to the sound to be played
   * @param {config} config sound config to be used
   */
  function play_sound(key, config = {}) {
    if (preload_sound_map.get(key)) {
      scene.sound.play(key, config);
    } else {
      throw_error(`${key} is not associated with any sound`);
    }
  }

  ///////////////////////////
  //         ANIMS         //
  ///////////////////////////

  /**
   * Create a new animation and add it to the available animations.
   * Animations are global i.e. once created, it can be used anytime, anywhere.
   *
   * NOTE: Anims DO NOT need to be added into the scene to be used.
   * It is automatically added to the scene when it is created.
   *
   * WIll return true if the animation key is valid
   * (key is specified within the anim_config); false if the key
   * is already in use.
   *
   * @param {config} anim_config
   * @returns {boolean} true if animation is successfully created, false otherwise
   */
  function create_anim(anim_config) {
    const anims = scene.anims.create(anim_config);
    return typeof anims !== "boolean";
  }









  /**
   * Start playing the given animation on image game object.
   *
   * @param {Phaser.GameObject.Sprite} image image game object
   * @param {string} anims_key key associated with an animation
   */
  function play_anim_on_image(image, anims_key) {
    if (is_type(image, image_type)) {
      get_obj(image).play(anims_key);
      return image;
    } else {
      throw_error(`${image} is not of type ${image_type}`);
    }
  }

  ///////////////////////////
  //         IMAGE         //
  ///////////////////////////

  /**
   * Create an image using the key associated with a loaded image.
   * If key is not associated with any loaded image, throws error.
   *
   * 0, 0 is located at the top, left hand side.
   *
   * @param {number} x x position of the image. 0 is at the left side
   * @param {number} y y position of the image. 0 is at the top side
   * @param {string} asset_key key to loaded image
   * @returns {Phaser.GameObjects.Sprite} image game object
   */
  function create_image(x, y, asset_key) {
    if (
      preload_image_map.get(asset_key) ||
      preload_spritesheet_map.get(asset_key)
    ) {
      const image = new Phaser.GameObjects.Sprite(scene, x, y, asset_key);
      return set_type(image, image_type);
    } else {
      throw_error(`${asset_key} is not associated with any image`);
    }
  }

  ///////////////////////////
  //          AWARD        //
  ///////////////////////////

  /**
   * Create an award using the key associated with the award.
   * The award key can be obtained from the Awards Hall or
   * Awards menu, after attaining the award.
   *
   * Valid award will have an on-hover VERIFIED tag to distinguish
   * it from images created by create_image.
   *
   * If student does not possess the award, this function will
   * return a untagged, default image.
   *
   * @param {number} x x position of the image. 0 is at the left side
   * @param {number} y y position of the image. 0 is at the top side
   * @param {string} award_key key for award
   * @returns {Phaser.GameObject.Sprite} award game object
   */
  function create_award(x, y, award_key) {
    return set_type(create_valid_award(x, y, award_key), award_type);
  }

  ///////////////////////////
  //         TEXT          //
  ///////////////////////////

  /**
   * Create a text object.
   *
   * 0, 0 is located at the top, left hand side.
   *
   * @param {number} x x position of the text
   * @param {number} y y position of the text
   * @param {string} text text to be shown
   * @param {config} config text configuration to be used
   * @returns {Phaser.GameObjects.Text} text game object
   */
  function create_text(x, y, text, config = {}) {
    const txt = new Phaser.GameObjects.Text(scene, x, y, text, config);
    return set_type(txt, text_type);
  }

  ///////////////////////////
  //       RECTANGLE       //
  ///////////////////////////

  /**
   * Create a rectangle object.
   *
   * 0, 0 is located at the top, left hand side.
   *
   * @param {number} x x coordinate of the top, left corner posiiton
   * @param {number} y y coordinate of the top, left corner position
   * @param {number} width width of rectangle
   * @param {number} height height of rectangle
   * @param {number} fill colour fill, in hext e.g 0xffffff
   * @param {number} alpha value between 0 and 1 to denote alpha
   * @returns {Phaser.GameObjects.Rectangle} rectangle object
   */
  function create_rect(x, y, width, height, fill = 0, alpha = 1) {
    const rect = new Phaser.GameObjects.Rectangle(
      scene,
      x,
      y,
      width,
      height,
      fill,
      alpha
    );
    return set_type(rect, rect_type);
  }

  ///////////////////////////
  //        ELLIPSE        //
  ///////////////////////////

  /**
   * Create an ellipse object.
   *
   * @param {number} x x coordinate of the centre of ellipse
   * @param {number} y y coordinate of the centre of ellipse
   * @param {number} width width of ellipse
   * @param {number} height height of ellipse
   * @param {number} fill colour fill, in hext e.g 0xffffff
   * @param {number} alpha value between 0 and 1 to denote alpha
   * @returns {Phaser.GameObjects.Ellipse} ellipse object
   */
  function create_ellipse(x, y, width, height, fill = 0, alpha = 1) {
    const ellipse = new Phaser.GameObjects.Ellipse(
      scene,
      x,
      y,
      width,
      height,
      fill,
      alpha
    );
    return set_type(ellipse, ellipse_type);
  }

  ///////////////////////////
  //       CONTAINER       //
  ///////////////////////////

  /**
   * Create a container object. Container is able to contain any other game object,
   * and the positions of contained game object will be relative to the container.
   *
   * Rendering the container as visible or invisible will also affect the contained
   * game object.
   *
   * Container can also contain another container.
   *
   * 0, 0 is located at the top, left hand side.
   *
   * For more details about container object, see:
   * https://photonstorm.github.io/phaser3-docs/Phaser.GameObjects.Container.html
   *
   * @param {number} x x position of the container
   * @param {number} y y position of the container
   * @returns {Phaser.GameObjects.Container} container object
   */
  function create_container(x, y) {
    const cont = new Phaser.GameObjects.Container(scene, x, y);
    return set_type(cont, container_type);
  }

  /**
   * Add the given game object to the container.
   * Mutates the container.
   *
   * @param {Phaser.GameObject.Container} container container object
   * @param {Phaser.GameObject.GameObject} objs game object to add to the container
   * @returns {Phaser.GameObject.Container} container object
   */
  function add_to_container(container, obj) {
    if (is_type(container, container_type) && is_any_types(obj, obj_types)) {
      get_obj(container).add(get_obj(obj));
      return container;
    } else {
      throw_error(
        `${obj} is not of type ${obj_types} or ${container} is not of type ${container_type}`
      );
    }
  }

  ///////////////////////////
  //         OBJECT        //
  ///////////////////////////

  /**
   * Destroy the given game object. Destroyed game object
   * is removed from the scene, and all of its listeners
   * is also removed.
   * 
   * @param {Phaser.GameObjects.GameObject} obj game object itself 
   */
  function destroy_obj(obj) {
    if (is_any_type(obj, obj_types)) {
      get_obj(obj).destroy();
    } else {
      throw_error(`${obj} is not of type ${obj_types}`);
    }
  }

  /**
   * Set the display size of the object.
   * Mutate the object.
   *
   * @param {Phaser.GameObjects.GameObject} obj object to be set
   * @param {number} x new display width size
   * @param {number} y new display height size
   * @returns {Phaser.GameObjects.GameObject} game object itself
   */
  function set_display_size(obj, x, y) {
    if (is_any_type(obj, obj_types)) {
      get_obj(obj).setDisplaySize(x, y);
      return obj;
    } else {
      throw_error(`${obj} is not of type ${obj_types}`);
    }
  }

  /**
   * Set the alpha of the object.
   * Mutate the object.
   *
   * @param {Phaser.GameObjects.GameObject} obj object to be set
   * @param {number} alpha new alpha
   * @returns {Phaser.GameObjects.GameObject} game object itself
   */
  function set_alpha(obj, alpha) {
    if (is_any_type(obj, obj_types)) {
      get_obj(obj).setAlpha(alpha);
      return obj;
    } else {
      throw_error(`${obj} is not of type ${obj_types}`);
    }
  }

  /**
   * Set the interactivity of the object.
   * Mutate the object.
   *
   * Rectangle and Ellipse are not able to receive configs, only boolean
   * i.e. set_interactive(rect, true); set_interactive(ellipse, false)
   *
   * @param {Phaser.GameObjects.GameObject} obj object to be set
   * @param {config} config interactive config to be used
   * @returns {Phaser.GameObjects.GameObject} game object itself
   */
  function set_interactive(obj, config = {}) {
    if (is_any_type(obj, obj_types)) {
      get_obj(obj).setInteractive(config);
      return obj;
    } else {
      throw_error(`${obj} is not of type ${obj_types}`);
    }
  }

  /**
   * Set the origin in which all position related will be relative to.
   * In other words, the anchor of the object.
   * Mutate the object.
   *
   * @param {Phaser.GameObjects.GameObject} obj object to be set
   * @param {number} x new anchor x coordinate, between value 0 to 1.
   * @param {number} y new anchor y coordinate, between value 0 to 1.
   * @returns {Phaser.GameObjects.GameObject} game object itself
   */
  function set_origin(obj, x, y) {
    if (is_any_type(obj, obj_types)) {
      get_obj(obj).setOrigin(x, y);
      return obj;
    } else {
      throw_error(`${obj} is not of type ${obj_types}`);
    }
  }












  /**
   * Set the position of the game object
   * Mutate the object
   *
   * @param {Phaser.GameObjects.Container} obj object to be set
   * @param {number} x new x position
   * @param {number} y new y position
   * @returns {Phaser.GameObjects.Container} game object itself
   */
  function set_position(obj, x, y) {
    if (obj && is_any_type(obj, obj_types)) {
      get_obj(obj).setPosition(x, y);
      return obj;
    } else {
      throw_error(`${obj} is not of type ${obj_types}`);
    }
  }

  /**
   * Set the scale of the object.
   * Mutate the object.
   *
   * @param {Phaser.GameObjects.GameObject} obj object to be set
   * @param {number} x new x scale
   * @param {number} y new y scale
   * @returns {Phaser.GameObjects.GameObject} game object itself
   */
  function set_scale(obj, x, y) {
    if (is_any_type(obj, obj_types)) {
      get_obj(obj).setScale(x, y);
      return obj;
    } else {
      throw_error(`${obj} is not of type ${obj_types}`);
    }
  }

  /**
   * Set the rotation of the object.
   * Mutate the object.
   *
   * @param {Phaser.GameObjects.GameObject} obj object to be set
   * @param {number} rad the rotation, in radians
   * @returns {Phaser.GameObjects.GameObject} game object itself
   */
  function set_rotation(obj, rad) {
    if (is_any_type(obj, obj_types)) {
      get_obj(obj).setRotation(rad);
      return obj;
    } else {
      throw_error(`${obj} is not of type ${obj_types}`);
    }
  }

  /**
   * Sets the horizontal and flipped state of the object.
   * Mutate the object.
   *
   * @param {Phaser.GameObjects.GameObject} obj game object itself
   * @param {boolean} x to flip in the horizontal state
   * @param {boolean} y to flip in the vertical state
   * @returns {Phaser.GameObjects.GameObject} game object itself
   */
  function set_flip(obj, x, y) {
    if (is_any_type(obj, obj_types)) {
      get_obj(obj).setFlip(x, y);
      return obj;
    } else {
      throw_error(`${obj} is not of type ${obj_types}`);
    }
  }

  /**
   * Create a tween to the object and plays it.
   * Mutate the object.
   *
   * @param {Phaser.GameObjects.GameObject} obj object to be added to
   * @param {config} config tween config
   * @returns {Phaser.GameObjects.GameObject} game object itself
   */
  async function add_tween(obj, config = {}) {
    if (is_any_type(obj, obj_types)) {
      scene.tweens.add({
        targets: get_obj(obj),
        ...config,
      });
      return obj;
    } else {
      throw_error(`${obj} is not of type ${obj_types}`);
    }
  }

  ///////////////////////////
  //       LISTENER        //
  ///////////////////////////

  /**
   * Attach a listener to the object. The callback will be executed
   * when the event is emitted.
   * Mutate the object.
   *
   * For all available events, see:
   * https://photonstorm.github.io/phaser3-docs/Phaser.Input.Events.html
   *
   * @param {Phaser.GameObjects.Container} obj object to be added to
   * @param {string} event the event name
   * @param {Function} callback listener function, executed on event
   * @returns {Phaser.Input.InputPlugin} listener
   */
  function add_listener(obj, event, callback) {
    if (is_any_type(obj, obj_types)) {
      const listener = get_obj(obj).addListener(event, callback);
      return set_type(listener, input_plugin_type);
    } else {
      throw_error(`${obj} is not of type ${obj_types}`);
    }
  }

  /**
   * Attach a listener to the object. The callback will be executed
   * when the event is emitted.
   * Mutate the object.
   *
   * For all available events, see:
   * https://photonstorm.github.io/phaser3-docs/Phaser.Input.Events.html
   *
   * For list of keycodes, see:
   * https://github.com/photonstorm/phaser/blob/v3.22.0/src/input/keyboard/keys/KeyCodes.js
   *
   * @param {string | number} key keyboard key
   * @param {string} event
   * @param {Function} callback listener function, executed on event
   * @returns {Phaser.Input.Keyboard.Key} listener
   */
  function add_keyboard_listener(key, event, callback) {
    const key_obj = scene.input.keyboard.addKey(key);
    const keyboard_listener = key_obj.addListener(event, callback);
    return set_type(keyboard_listener, keyboard_key_type);
  }

  /**
   * Deactivate and remove listener.
   *
   * @param {Phaser.Input.InputPlugin | Phaser.Input.Keyboard.Key} listener
   */
  function remove_listener(listener) {
    if (is_any_type(listener, listener_types)) {
      get_obj(listener).removeAllListeners();
      return true;
    }
    return false;
  }
