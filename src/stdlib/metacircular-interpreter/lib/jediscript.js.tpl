jQuery(document).ready(function() {
	var scripts = jQuery("script[type='text/jediscript'], script[language='jediscript'], " +
		"script[language='JediScript']");
	for (var i = 0; i < scripts.length; ++i) {
{{if native}}
		if (scripts[i].src) {
			jQuery.ajax(scripts[i].src, {
				accepts: "text/javascript, text",
				dataType: "text",
				success: (function(i) {
					return function(data, textStatus, jqXHR) {
						if (parse(jqXHR.responseText)) {
							var newScript = document.createElement("script");
							newScript.src = scripts[i].src;
							newScript.type = "text/javascript";
							newScript.charset = "utf-8";

							scripts[i].parentNode.insertBefore(newScript, scripts[i]);
						}
					};
				})(i)
			});
		} else {
			var script = jQuery(scripts[i]).html();
			if (parse(script)) {
				var newScript = document.createElement("script");
				newScript.type = "text/javascript";
				newScript.charset = "utf-8";
				newScript.innerHTML = script;

				scripts[i].parentNode.insertBefore(newScript, scripts[i]);
			}
		}
{{else}}
		if (scripts[i].src) {
			jQuery.ajax(scripts[i].src, {
				accepts: "text/javascript, text",
				dataType: "text",
				success: (function(i) {
					return function(data, textStatus, jqXHR) {
						parse_and_evaluate(jqXHR.responseText);
					};
				})(i)
			});
		} else {
			var script = jQuery(scripts[i]).html();
			parse_and_evaluate(script);
		}
{{/if}}
	}
});
