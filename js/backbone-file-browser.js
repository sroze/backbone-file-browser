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
            browserView.setRouter(new BrowserRouter());
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
    
    /**
     * Multiple extends.
     * 
     */
    Backbone.Model.extendEach      =
    Backbone.Collection.extendEach =
    Backbone.Router.extendEach     =
    Supermodel.Model.extendEach    =
    Backbone.PageableCollection.extendEach =
    Backbone.View.extendEach       = function () {
        var args  = Array.prototype.slice.call(arguments),
            child = this;
     
        _.each(args, function (proto) {
          child = child.extend(proto);
        });
     
        return child;
    };
    
    /**
     * Browser configuration.
     * 
     */
    var router = null, currentFolder = null, userOptions = {
        file_url: '/file/__file_id__',
        children_url: '/children/__file_id__',
        
        viewType: "list",
        sortColumns: {},
        displayedColumns: ["btn-checkbox", "icon", "name", "size", "actions"],
        showBar: true
    }, browserCache = new Backbone.Cache();
    
    /**
     * A file metadata.
     * 
     */
    var FileMetadata = Supermodel.Model.extendEach(Backbone.CachedModel.prototype, {
	cacheObject: browserCache,
	
	getName: function () {
	    return this.get('name');
	},
	
        getValue: function () {
            return this.get('value');
        },
        
        setValue: function (value) {
            this.set('value', value);
        },
        
        getDescription: function () {
            return this.get('description');
        }
    });
    
    /**
     * Options:
     * - file_url
     * 
     * Attributes:
     * - id
     */
    var File = Supermodel.Model.extendEach(Backbone.CachedModel.prototype, {
	cacheObject: browserCache,
	
        TYPE_FILE: 1,
        TYPE_FOLDER: 2,
        parents: null,
        
        constructor: function (attributes, options) {
            Supermodel.Model.apply(this, arguments);
            this.options = options;
            this.cacheKey = 'file_'+this.get('id');
            
            var self = this;
            this.url = function () {
                return userOptions.file_url.replace('__file_id__', self.get('id'));
            }
        },
        
        // Return file parents by calling the callback
        // with array of parents collection
        getParents: function (callback)
        {
            if (this.parents == null || true) {
                var self = this;
                console.log('getParents -> resursive');
                this.recursiveGetParents(function(parents){
                    self.parents = parents;
                    callback(parents);
                });
            } else {
                console.log('getParents cache');
                return this.parents;
            }
        },
        
        // Get parents with recursive function
        recursiveGetParents: function (callback)
        {
            if (this.get('parentId') != null) {
                var parent = File.create({id: this.get('parentId')});
                parent.fetch({cache: true, expires: 60}).done(function(file){
                    parent.recursiveGetParents(function(parents){
                        parents.push(parent);
                        console.log('recursiveGetParents parent #'+parents.length);
                        callback(parents);
                    });
                }).fail(function(){
                    callback([]);
                })
            } else {
                callback([]);
            }
        },
        
        // Get children collection, not fetched.
        getChildren: function ()
        {
            return new FileCollection([], {
                children_url: userOptions.children_url,
                parentId: this.get('id')
            })
        },
        
        // Parse the metadatas
        parse: function (resp, options) {
            if (resp.metadatas != undefined) {
                for (var key in resp.metadatas) {
                    resp.metadatas[key] = FileMetadata.create(resp.metadatas[key], options);
                }
            }
            
            return resp;
        },
    
        // Return object that represents this model for browser
        getBrowserData: function () {
            return this.toJSON();
        },
        
        getMetadata: function (key) {
            var metadatas = this.get('metadatas');
            if (metadatas[key] != undefined) {
                return metadatas[key];
            }
        },
        
        setMetadata: function (key, value) {
            var metadatas = this.get('metadatas');
            if (metadatas[key] == undefined) {
                metadatas[key] = new FileMetadata({
                    name: key
                });
            }
            
            metadatas[key].setValue(value);
            this.set('metadatas', metadatas);
        },
        
        isFile: function () {
            return this.get('type') == this.TYPE_FILE;
        },
        
        isFolder: function () {
            return this.get('type') == this.TYPE_FOLDER;
        },
    });
    
    /**
     * Options:
     * 
     * - children_url
     * - parentIf
     */
    var FileCollection = Backbone.PageableCollection.extendEach(/*Backbone.CachedCollection,*/ {
        model: function (attributes, options) {
            return File.create(attributes, options);
        },
        
        constructor: function (models, options) {
            Backbone.PageableCollection.apply(this, arguments);
            
            this.options = options;
            
            var self = this;
            this.url = function () {
                return userOptions.children_url.replace('__file_id__', self.options.parentId)
            }
        },

        // Any `state` or `queryParam` you override in a subclass will be merged with
        // the defaults in `Backbone.PageableCollection` 's prototype.
        state: {
            // You can use 0-based or 1-based indices, the default is 1-based.
            // You can set to 0-based by setting ``firstPage`` to 0.
            firstPage: 0,
            
            // Set this to the initial page index if different from `firstPage`. Can
            // also be 0-based or 1-based.
            currentPage: 0
        },
        
        // You can configure the mapping from a `Backbone.PageableCollection#state`
        // key to the query string parameters accepted by your server API.
        queryParams: {
            currentPage: "current_page",
            pageSize: "page_size"
        }
    });
    
    /**
     * The information view.
     * 
     */
    var InformationView = Backbone.DeferedView.extend({
        tagName:"div",
        templateName: "browser-information",
        className: "browser-information span2",
        provider: null,

        initialize:function () {
            this.model.on("all", this.deferedRender, this);
            this.model.on("destroy", this.close, this);
        },

        render:function (eventName) {
            var view = this;
            $(this.el).html(this.template(this.computeData()));
            
            // Add events
            var selected_model = this.model.length > 0 ? this.model.at(0) : currentFolder;
            var editable_field = $('#file_description', this.el).editable({
        	title: 'Enter description',
        	placement: 'left'
            }).on('save', function(e, params) {
        	selected_model.setMetadata("description", params.newValue);
        	selected_model.save();
            });
            
            
            $('i#edit_description', this.el).click(function(){
        	editable_field.editable('show');
        	return false;
            })
        },
        
        computeData: function () {
            return _.extend({
                selection: this.model,
                current: currentFolder
            }, this.getHelpers());
        }
    });
    
    /**
     * The browser bar.
     * 
     */
    var BrowserBarView = Backbone.DeferedView.extend({
        templateName: "browser-bar",
        tagName: "div",
        className: "browser-bar",
        
        browse: function (file) {
            this.file = file;
        },
        
        render: function (eventName) {
            $(this.el).html(this.template());

            // Display breadcrumb
            var bc = $('div.breadcrumb', self.el);
            var file = this.file;
            this.file.getParents(function(parents){
                for (var i = 0; i < parents.length; i++) {
                    var parent = parents[i];
                    $('ul', bc).append('<li><a href="#tree/'+parent.get('id')+'">'+parent.get('name')+'</a></li>');
                }
                
                // Append current directory
                $('ul', bc).append('<li><a href="#tree/'+file.get('id')+'">'+file.get('name')+'</a></li>');
                
                // jBreadcrumb-ize
                bc.jBreadCrumb();
            });
        }
    });
    
    /**
     * An item in the list view.
     * 
     */
    var ItemView = Backbone.DeferedView.extend({

        tagName:"tr",
        templateName: "browser-list-item",
        className: "item browser-item",

        initialize:function () {
            this.model.on("change", this.deferedRender, this);
            this.model.on("destroy", this.close, this);
            
            // Bind on columns change
            this.options.listView.model.on("columnsChange", this.refreshColumns, this);
        },
        
        // Dispatch selection event to browser list view
        setSelected: function (boolean) {
            this.options.listView.setSelected(this.model, boolean);
        },

        render:function (eventName) {
            var view = this;
            $(this.el).attr("id", "object-"+this.model.get("uid"));
            $(this.el).html(this.template(_.extend(this.model.getBrowserData(), this.getHelpers())));
            
            // Add class
            if (this.model.isFile()) {
                $(this.el).addClass('file');
            } else if (this.model.isFolder()) {
                $(this.el).addClass('folder');
            }
            
            // Add checkbox event
            $('div.btn-checkbox', this.el).unbind('click').bind('click', function(e) {
                $(view.el).toggleClass('selected');
                view.setSelected($(view.el).hasClass('selected'));
            });
            
            // If is actually selected, add class
            if (this.options.listView.isSelected(this.model)) {
                $(this.el).addClass('selected');
            }
            
            // Add line click event
            $('td', this.el).unbind('click').bind('click', function(e){
                if ($(e.target).not('div.btn-checkbox, div.checkbox-inner, a, img#img-pie').length == 1) {
                    $('div.btn-checkbox', view.el).click();
                }
            });
            
            // Display or not columns
            this.refreshColumns(userOptions.displayedColumns);
            
            return this;
        },
        
        refreshColumns: function (columns) {
            var columnsObjects = $('td', this.el);
            columnsObjects.css('display', 'none');
            for (var i = 0; i < columns.length; i++) {
                columnsObjects.filter('.'+columns[i]).css('display', '');
            }
        }

    });

    /**
     * A list of file rows.
     * 
     */
    var ListItemView = Backbone.DeferedView.extend({

        tagName:'div',
        templateName: "browser-list",
        className: 'row-fluid',
        selected: null,
        availableColumns: {
            "btn-checkbox": null,
            "icon": null,
            "name": "Name",
            "size": "Size",
            "actions": null
        },
        breadcrumb: null,
        informationView: null,
        synched: false,
        templateLoaded: false,
        loadedCountDown: 2,
        
        // Unbind model events on close
        onClose: function () {
            this.model.off("reset", this.render, this);
            this.model.off("columnsChange", this.columnsChanged, this);
            this.model.off("selectionChange", this.selectionChanged, this);
            this.model.off("add", this.addDataObject, this);
            this.model.off("sync", undefined, this);
            
            if (this.informationView != null) {
                this.informationView.close();
            }
        },

        initialize:function () {
            this.selected = new FileCollection([], {
                children_url: userOptions.children_url
            });
            
            // Add models events
            var self = this;
            this.model.on("reset", this.render, this);
            this.model.on("columnsChange", this.columnsChanged, this);
            this.model.on("selectionChange", this.selectionChanged, this);
            this.model.on("add", this.addDataObject, this);
            this.model.on("sync", function () {
                this.synched = true;
                this.isLoaded(true);
            }, this);
        },
        
        setSorting: function (key, sort) {
            if (sort == "none" || sort == "" || sort == undefined) {
                userOptions.sortColumns[key] = undefined;
            } else {
                userOptions.sortColumns[key] = sort;
            }
        },
        
        // Is a model selected ?
        isSelected: function (model) {
            return this.selected.get(model) != undefined;
        },
        
        // Change selection of a model
        setSelected: function (model, selected) {
            if (selected) {
                this.selected.add(model, {merge: true});
            } else {
                this.selected.remove(model);
            }
            
            this.refreshBrowserBar();
            this.model.trigger("selectionChange", this.getSelected());
        },
        
        // Return array of selected objects
        getSelected: function () {
            return this.selected;
        },
        
        // Selection changed
        selectionChanged: function (selection) {
            // TODO
        },
        
        // Refresh the browser bar
        refreshBrowserBar: function () {
            var browserbar = $("div#browser-bar", this.el);
            var self = this;
            
            // Refresh the table head multi-selector
            if (userOptions.showBar == true) {
                browserbar.show();
                var globalcb = $('div#selector-toggle div.btn-checkbox', $(this.el).parent());
                globalcb.removeClass('selected').removeClass('partial');
                if (this.getSelected().length > 0) {
                    if (this.getSelected().length == this.model.length) {
                        globalcb.addClass('selected');
                    } else {
                        globalcb.addClass('partial');
                    }
                }
                
                // Selection status text
                this.selectionChanged(this.getSelected());
                
                // Set the selected list type
                $("div#btn-group-list-type button", browserbar).removeClass("active").filter("button#btn-list-"+userOptions.viewType).addClass("active");
                
                // Refresh the displayed columns list
                var groupDisplayColumns = $('#display-columns-toggle');
                if (userOptions.viewType == "list") {
                    groupDisplayColumns.show();
                    var columnsul = $('ul#dd-menu-columns', browserbar).empty();
                    for (var key in this.availableColumns) {
                        var name = this.availableColumns[key], selected = userOptions.displayedColumns.indexOf(key) != -1;
                        if (name != null) {
                            columnsul.append(
                                '<li><label><input type="checkbox" name="columns[]" value="'+key+'" '+
                                (selected ? 'checked="checked" ' : '')+
                                '/> '+name+'</label></li>'
                            );
                        }
                    }
                } else if (userOptions.viewType == "icons") {
                    groupDisplayColumns.hide();
                }
                
                // Refresh the sorting tab
                var columnsul = $('ul#dd-menu-sort', browserbar).empty();
                for (var key in this.availableColumns) {
                    var name = this.availableColumns[key], sort = userOptions.sortColumns[key];
                    if (name != null) {
                        var li = $(
                            '<li><label>'+
                            '<div class="btn-group">'+
                                '<button id="sort-'+key+'-none" class="btn btn-bullet-black'+(sort == undefined ? ' active' : '')+'" rel="tooltip" title="No sort"><div class="img"></div></button>'+
                                '<button id="sort-'+key+'-asc" class="btn btn-arrow-up'+(sort == 'asc' ? ' active' : '')+'" rel="tooltip" title="Ascendent"><div class="img"></div></button>'+
                                '<button id="sort-'+key+'-desc" class="btn btn-arrow-down'+(sort == 'desc' ? ' active' : '')+'" rel="tooltip" title="Descendant"><div class="img"></div></button>'+
                            '</div>'+name+
                            '</label></li>'
                        ).appendTo(columnsul);
                        
                        // Add toggle button events
                        $('button', li).unbind('click').bind('click', function(e){
                            e.preventDefault();
                            
                            var id = $(e.currentTarget).attr('id');
                            var sort = id.substr(id.lastIndexOf('-')+1);
                            var key = id.substring(id.indexOf('-')+1, id.lastIndexOf('-'));
                            self.setSorting(key, sort);
                            $('button', $(this).parent()).removeClass('active');
                            $(this).addClass('active');
                            self.refreshData();
                        });
                    }
                }
                
                // Init tooltips
                $('[rel=tooltip]', browserbar).each(function(){
                    if (!$(this).hasClass('tooltiped')) {
                        $(this).addClass('tooltiped').tooltip();
                    }
                });
        
                // Add events
                this.addBrowserBarEvents();
            } else {
                browserbar.hide();
            }
        },
        
        refreshData: function () {
            alert('TODO: Refresh data');
        },

        render:function (eventName) {
            // Clear this element
            $(this.el).empty();
            $(this.el).html(this.template(this.model.toJSON()));
            
            // Add header events
            var multiCheckbox = $('div#selector-toggle div.btn-checkbox', this.el);
            multiCheckbox.unbind('click').bind('click', function(e){
                self.multiSelectorClicked(this);
            });
            
            // Depending on the list type
            $('.browser', this.el).css('display', 'none');
            if (userOptions.viewType == "list") {
                $('.browser-list', this.el).css('display', '');
            } else if (userOptions.viewType == "icons") {
                $('.browser-icons', this.el).css('display', '');
            }
            
            // Render each item
            var self = this;
            _.each(this.model.models, function (file) {
                self.addDataObject(file);
            }, this);
            
            // Create the information view
            if (this.informationView == null) {
                this.informationView = new InformationView({model: this.selected});
                $(this.el).append(this.informationView.deferedRender().el);
            }
            
            this.columnsChanged(userOptions.displayedColumns);
            
            return this;
        },
        
        // Add a file
        addDataObject: function (file) {
            // Add object view
            if (userOptions.viewType == "list") {
                $('table#browser tbody#browser-body', this.el).append(new ItemView({model:file, listView: this}).deferedRender().el);
            } else if (userOptions.viewType == "icons") {
                $('div#browser.browser-icons', this.el).append(new IconView({model:file, listView: this}).deferedRender().el);
            }
        },
        
        multiSelectorClicked: function(checkbox){
            if ($(checkbox).hasClass('partial') || $(checkbox).hasClass('selected')) {
                $('.browser-item', this.el).removeClass('selected');
                $(checkbox).removeClass('selected');
                var currentSelected = this.getSelected().toArray();
                for (var i = 0; i < currentSelected.length; i++) {
                    this.setSelected(currentSelected[i], false);
                }
            } else {
                for (var i = 0; i < this.model.length; i++) {
                    this.setSelected(this.model.models[i], true);
                }
                $('.browser-item', this.el).addClass('selected');
                $(checkbox).addClass('selected');
            }
            $(checkbox).removeClass('partial');
            this.refreshBrowserBar();
        },
        
        setViewType: function (type) {
            userOptions.viewType = type;
            this.deferedRender();
        },
        
        setColumnSelected: function (key, selected) {
            if (selected && userOptions.displayedColumns.indexOf(key) == -1) {
                userOptions.displayedColumns.push(key);
            } else if (!selected && userOptions.displayedColumns.indexOf(key) != -1) {
                var index = userOptions.displayedColumns.indexOf(key);
                userOptions.displayedColumns.remove(index);
            }
            
            this.model.trigger("columnsChange", userOptions.displayedColumns);
            this.refreshBrowserBar();
        },
        
        columnsChanged: function (columns) {
            var columnsObjects = $('th', this.el);
            columnsObjects.css('display', 'none');
            for (var i = 0; i < columns.length; i++) {
                columnsObjects.filter('.'+columns[i]).css('display', '');
            }
        },
        
        addBrowserBarEvents: function () {
            var browserbar = $("div#browser-bar", this.el);
            var self = this;
            
            // Add list type toggle
            $("div#btn-group-list-type button", browserbar).unbind('click').bind('click', function (e){
                var id = $(e.currentTarget).attr('id');
                var listType = id.substr(id.lastIndexOf("-")+1);
                $(this).tooltip("destroy");
                self.setViewType(listType);
            });
            
            // Add displayed columns events
            $('ul#dd-menu-columns input[type="checkbox"]', browserbar).unbind('click').bind('click', function (e){
                self.setColumnSelected($(this).attr("value"), $(this).is(':checked'));
            });
        }
    });
    
    var BaseView = Backbone.DeferedView.extend({
        currentPath: 'root',
        tagName: 'div',
        loadedCountDown: 0,
        
        initialize: function ()
        {
            userOptions = $.extend({}, userOptions, this.options || {});
        },
        
        render: function ()
        {
            this.clear();
            this.isLoaded(false);
            
            // Get file object
            currentFolder = File.create({id: this.currentPath}), self = this;
            
            // Add browser bar
            if (this.browserbar == null) {
                this.browserbar = new BrowserBarView();
            }
            this.browserbar.browse(currentFolder);
            
            // Refresh browser bar and its events
            $(this.el).prepend(this.browserbar.el);
            
            // Render list
            var files = currentFolder.getChildren();
            console.log('fetch file from BaseView:render');
            currentFolder.fetch({cache: true, expires: 60}).done(function(){
        	self.browserbar.deferedRender();
        	
                self.list = new ListItemView({model: files});
                self.isLoaded(true);
                
                $(self.el).append(self.list.deferedRender().el);
                
                console.log('fetch children file from BaseView:render');
                files.fetch({cache: true, expires: 60}).fail(function(){
                    // FIXME
                });
            }).fail(function(){
                // FIXME
            });
        },
        
        setRouter: function (instance_router) {
            router = instance_router;
        },
        
        browse: function (path)
        {
            this.currentPath = path;

            this.render();
        },
        
        clear: function () {
            if (this.list != null) {
                this.list.close();
            }
        }
    });
    
    return BaseView;
}));