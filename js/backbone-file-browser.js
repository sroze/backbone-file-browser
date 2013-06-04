/**
 * Backbone.js File Browser
 *
 * @author Samuel ROZE
 */
(function(factory){
	// TODO AMD and require.js declarations
	
	// Create the backbone view
	Backbone.Browser = factory(jQuery, Backbone);
	
	// Create the jQuery extension
	if (jQuery !== undefined) {
		jQuery.browser = {
	        instances : []
	    };
		
		// Create the jQuery wrapper
		var jQueryBrowser = function (element, options) {
			// Create browser view
			var browserView = new Backbone.Browser(options);
			$(element).html(browserView.el);
			
			// Create browser router
			var BrowserRouter = Backbone.Router.extend({
			    routes:{
			        "": "tree",
			        "tree/*path": "tree"
			    },
			    
			    tree: function (path) {
			    	if (path == undefined) {
			    		path = "root";
			    	}
			    	
			    	browserView.browse(path);
			    }
			});
			
			// Start history
			new BrowserRouter();
			Backbone.history.start();
		};
	    
		// Create function
		jQuery.fn.browser = function (selectOptions) {
	        return this.each(function () {
	            var browser = new jQueryBrowser(this, selectOptions);
	            jQuery.browser.instances.push(browser);
	        });
	    };
	}
}(function($, Backbone){
	var baseView = Backbone.DeferedView.extend({
		templateName: 'browser-view',
		currentPath: 'root',
		
		render: function ()
		{
			this.$el.html(this.template({
				path: this.currentPath
			}));
		},
		
		browse: function (path)
		{
			this.currentPath = path;
			
			this.deferedRender();
		}
	});
	
	return baseView;
}));