///<reference path="./lib.d.ts"/>

import path = require('path');

import {
  ActivityMonitor, PathExt,ISettingRegistry//,nbformat
} from '@jupyterlab/coreutils';

import {
  Toolbar,ToolbarButton, Clipboard, Dialog, showDialog,showErrorMessage
} from '@jupyterlab/apputils';

import {
  DocumentRegistry,
  Context
} from '@jupyterlab/docregistry';

import {
  Widget, BoxLayout
} from '@phosphor/widgets';

import {
  Message
} from '@phosphor/messaging';

import {
  IDocumentManager, DocumentManager
} from '@jupyterlab/docmanager';
/*
import {
  NotebookPanel,NotebookModel,NotebookActions
} from '@jupyterlab/notebook';
*/
import {
  ISignal, Signal
} from '@phosphor/signaling';

import { CreateVoyager, Voyager } from 'datavoyager/build/lib-voyager';
import { VoyagerConfig } from 'datavoyager/build/models/config';
import 'datavoyager/build/style.css';
import { read } from 'vega-loader';

import {
  PromiseDelegate
} from '@phosphor/coreutils';

import '../style/index.css';
import { JupyterLab } from '@jupyterlab/application';
//import { CommandRegistry } from '@phosphor/commands';
//import { Contents } from '@jupyterlab/services';
/**
 * The mimetype used for Jupyter cell data.
 */
const JUPYTER_CELL_MIME = 'application/vnd.jupyter.cells';


const VOYAGER_PANEL_TOOLBAR_CLASS = 'jp-VoyagerPanel-toolbar';
/**
 * The class name added to toolbar save button.
 */
const TOOLBAR_SAVE_CLASS = 'jp-SaveIcon';

/**
 * The class name added to toolbar insert button.
 */
const TOOLBAR_EXPORT_CLASS = 'jp-ExportIcon';

/**
 * The class name added to toolbar insert button.
 */
const TOOLBAR_COPY_CLASS = 'jp-CopyIcon';

/**
 * The class name added to toolbar cut button.
 */
const TOOLBAR_UNDO_CLASS = 'jp-UndoIcon';

/**
 * The class name added to toolbar copy button.
 */
const TOOLBAR_REDO_CLASS = 'jp-RedoIcon';

/**
 * The class name added to a datavoyager widget.
 */
const Voyager_CLASS = 'jp-Voyager';

export
function createSaveButton(widget: VoyagerPanel|VoyagerPanel_DF): ToolbarButton {
  return new ToolbarButton({
    className: TOOLBAR_SAVE_CLASS,
    onClick: () => {
      if(widget&&widget.hasClass(Voyager_CLASS)&&(widget as VoyagerPanel).context.path.indexOf('vl.json')!==-1){
        var datavoyager = (widget as VoyagerPanel).voyager_cur;
        var dataSrc = (widget as VoyagerPanel).data_src;
        let spec = datavoyager.getSpec(false);
        let context = widget.context as Context<DocumentRegistry.IModel>;
        context.model.fromJSON({
          "data":dataSrc, 
          "mark": spec.mark, 
          "encoding": spec.encoding, 
          "height":spec.height, 
          "width":spec.width, 
          "description":spec.description,
          "name":spec.name,
          "selection":spec.selection,
          "title":spec.title,
          "transform":spec.transform
        });
        context.save();
      }
      else{
        showDialog({
          title: "Source File Type is NOT Vega-Lite (.vl.json)",
          body: "To save this chart, use 'Export Voyager as Vega-Lite file' ",
          buttons: [Dialog.warnButton({ label: "OK"})]
        })
      }
    },
    tooltip: 'Save Voyager',    
  });
}

export
function createExportButton(widget: VoyagerPanel|VoyagerPanel_DF, app:JupyterLab,docManager:DocumentManager): ToolbarButton {
  return new ToolbarButton({
    className: TOOLBAR_EXPORT_CLASS,
    onClick: () => {
      var datavoyager = (widget as VoyagerPanel).voyager_cur;
      var dataSrc = (widget as VoyagerPanel).data_src;
      //let aps = datavoyager.getApplicationState();
      let spec = datavoyager.getSpec(false);
      //let context = docManager.contextForWidget(widget) as Context<DocumentRegistry.IModel>;
      let context = widget.context as Context<DocumentRegistry.IModel>;
      let path = PathExt.dirname(context.path);
      var content:any;
      if(spec!==undefined){
        content = {
          "data":dataSrc, 
          "mark": spec.mark, 
          "encoding": spec.encoding, 
          "height":spec.height, 
          "width":spec.width, 
          "description":spec.description,
          "name":spec.name,
          "selection":spec.selection,
          "title":spec.title,
          "transform":spec.transform
          };   
      }
      else{
        content ={
          "data":dataSrc, 
          };  
      }
      let input_block = document.createElement("div");
      let input_prompt = document.createElement("div");
      input_prompt.textContent = '';
      let input = document.createElement("input");
      input_block.appendChild(input_prompt);
      input_block.appendChild(input);
      let bd = new Widget({node:input_block});
      showDialog({
        title: "Export as Vega-Lite File (.vl.json)",
        body: bd,
        buttons: [Dialog.cancelButton(), Dialog.okButton({ label: "OK"})]
      }).then(result=>{
        let msg = input.value;
        if(result.button.accept){
          if(!isValidFileName(msg)){
            showErrorMessage('Name Error', Error(
              `"${result.value}" is not a valid name for a file. ` +
              `Names must have nonzero length, ` +
              `and cannot include "/", "\\", or ":"`
          ));
          }
          else{
            let basePath = path;
            let newPath = PathExt.join(basePath, msg.indexOf('.vl.json')!==-1?msg:msg+'.vl.json');
              app.commands.execute('docmanager:new-untitled', {
              path: basePath, ext: '.vl.json', type: 'file'
            }).then(model => {
              docManager.rename(model.path, newPath).then(model=>{
                app.commands.execute('docmanager:open', {
                path: model.path, factory: "Editor"
              }).then(widget=>{
                let context = docManager.contextForWidget(widget);
                if(context!=undefined){
                  context.save().then(()=>{
                    if(context!=undefined){
                      context.model.fromJSON(content);
                      context.save()    
                    }
                  })
                }})
              })
            });
          }}
      })
    },
    tooltip: 'Export Voyager as Vega-Lite File'
  });
}

export
function createCopyButton(widget: VoyagerPanel|VoyagerPanel_DF, app:JupyterLab,docManager:DocumentManager): ToolbarButton {
  return new ToolbarButton({
    className: TOOLBAR_COPY_CLASS,
    onClick: () => {

          var datavoyager = widget.voyager_cur;
          var dataSrc = widget.data_src;
          let spec = datavoyager.getSpec(false);
          let src =JSON.stringify({
            "data":dataSrc, 
            "mark": spec.mark, 
            "encoding": spec.encoding, 
            "height":spec.height, 
            "width":spec.width, 
            "description":spec.description,
            "name":spec.name,
            "selection":spec.selection,
            "title":spec.title,
            "transform":spec.transform
          });
          let clipboard = Clipboard.getInstance();
          clipboard.clear();
          let data = [{
            "cell_type": "code",
            "execution_count": null,
            "metadata": {},
            "outputs": [],
            "source": [
              "import altair as alt\n",
              "import pandas as pd\n",
              "import json\n",
              `data_src = json.loads('''${src}''')\n`,
              "alt.Chart.from_dict(data_src)\n",
            ]
           }]
          clipboard.setData(JUPYTER_CELL_MIME, data);
          /*
          let path = PathExt.dirname(widget.context.path);
          app.commands.execute('docmanager:new-untitled', {
            path: path, type: 'notebook', kernelPreference:{autoStartDefault:true}
          }).then(model => {
              app.commands.execute('docmanager:open', {
              path: model.path, factory: 'Notebook', kernel:{name: 'Python 3'}
            }).then(widget=>{
              let md = (widget as NotebookPanel).notebook.model.toJSON() as nbformat.INotebookContent;
              let model = new NotebookModel();
              md.cells = [{
                "cell_type": "code",
                "execution_count": null,
                "metadata": {},
                "outputs": [],
                "source": [
                  "import altair as alt\n",
                  "import pandas as pd\n",
                  "import json\n",
                  `data_src = json.loads('''${src}''')\n`,
                  "alt.Chart.from_dict(data_src)\n",
                ]
               }];
              model.fromJSON(md);
              (widget as NotebookPanel).notebook.model = model;
              widget.context.save().then(()=>{
                NotebookActions.runAll(widget.notebook, widget.context.session);
              });
              
            });
          }); 
          */        
    },
    tooltip: 'Copy Altair Graph to clipboard'
  });
}


export
function createUndoButton(widget: VoyagerPanel|VoyagerPanel_DF): ToolbarButton {
  return new ToolbarButton({
    className: TOOLBAR_UNDO_CLASS,
    onClick: () => {
      (widget as VoyagerPanel).voyager_cur.undo();
    },
    tooltip: 'Undo'
  });
}

export
function createRedoButton(widget: VoyagerPanel|VoyagerPanel_DF): ToolbarButton {
  return new ToolbarButton({
    className: TOOLBAR_REDO_CLASS,
    onClick: () => {
      (widget as VoyagerPanel).voyager_cur.redo();
    },
    tooltip: 'Redo'
  });
}
/*
export
function createBookMarkButton(widget: VoyagerPanel|VoyagerPanel_DF): ToolbarButton {
  return new ToolbarButton({
    className: TOOLBAR_REDO_CLASS,
    onClick: () => {
      (widget as VoyagerPanel).voyager_cur.getBookmarkedSpecs();
    },
    tooltip: 'display all the bookmarks'
  });
}
*/

export
function isValidFileName(name: string): boolean {
  const validNameExp = /[\/\\:]/;
  return name.length > 0 && !validNameExp.test(name);
}

function isValidURL(str:string) {
  var a  = document.createElement('a');
  a.href = str;
  return (a.host && a.host != window.location.host);
}

/**
 * A namespace for `VoyagerPanel` statics.
 */
export
namespace VoyagerPanel {
  /**
   * Instantiation options for Voyager widgets.
   */
  export
  interface IOptions {
    /**
     * The document context for the Voyager being rendered by the widget.
     */
    context: DocumentRegistry.Context;
    fileType: string;
  }
}
export
class VoyagerPanel extends Widget implements DocumentRegistry.IReadyWidget {
  static config: VoyagerConfig = {
    // don't allow user to select another data source from Voyager UI
    showDataSourceSelector: false,
    serverUrl: null,
    hideHeader: true,
    hideFooter: true,
    relatedViews: 'initiallyCollapsed',
    wildcards: 'enabled'

  }
  public voyager_cur: Voyager;
  public voyager_widget: Widget;
  public data_src:any;
  public fileType: String;
  public toolbar:Toolbar<Widget>;
  // it would make sense to resolve this promise after we have parsed the data
  // and created the Voyager component, but this will trigger an attempted
  // cleanup of the spinner element, which will already have been deleted
  // by the Voyager constructor and so will raise an exception.
  // So instead we just never resolve this promise, which still gives us the
  // spinner until Voyager overwrites the element.

  constructor(options: VoyagerPanel.IOptions, app:JupyterLab, docManager: IDocumentManager) {
    super();
    this.addClass(Voyager_CLASS);
    const context = this._context = options.context;
    this.fileType = options.fileType;

    this.title.label = PathExt.basename(context.path);
    context.pathChanged.connect(this._onPathChanged, this);
    context.model.contentChanged.connect(this.update, this);
    context.fileChanged.connect(this.update, this);
    this._onPathChanged();

    let layout = this.layout = new BoxLayout({spacing: 0});
    layout.direction = 'top-to-bottom';

    this.voyager_widget = new Widget();

    this._context.ready.then(_ => {
      this._ready.resolve(undefined);
      const data = context.model.toString();
      var values:any;
      if(this.fileType==='txt'){
        values = read(data, { type: 'json' });
      }
      else{
        console.log(data)
        values = read(data, { type: this.fileType });
        console.log(values)
      }
      if(this.fileType==='json'||this.fileType==='txt'){
        if(values['data']){
          var DATA = values['data'];
          this.data_src = DATA;
          console.log(values['data']);
          if(DATA['url']){ //check if it's url type datasource
            if(!isValidURL(DATA['url'])){
              //console.log('data url is: '+DATA['url'])
              //fetch(DATA['url']).then(response => {console.log(response)})
              //console.log('local url')
              //values['data']['url'] = '/files/'+values['data']['url']
              //this.voyager_cur = CreateVoyager(this.voyager_widget.node, VoyagerPanel.config, values['data']);
              
              console.log('local url');
              let basePath = PathExt.dirname(this._context.localPath)
              console.log(basePath)
              let wholePath = path.join(basePath, DATA['url'])
              console.log(wholePath)
              docManager.services.contents.get(wholePath).then(src=>{
                console.log(src.content);
                let local_filetype = PathExt.extname(DATA['url']).substring(1);
                let local_values = read(src.content, { type: local_filetype })
                this.voyager_cur = CreateVoyager(this.voyager_widget.node, VoyagerPanel.config, {'values':local_values});
                this.voyager_cur.setSpec({
                  "mark": values['mark'], 
                  "encoding": values['encoding'], 
                  "height":values['height'], 
                  "width":values['width'], 
                  "description":values['description'],
                  "name":values['name'],
                  "selection":values['selection'],
                  "title":values['title'],
                  "transform":values['transform']
              });
              })            
            }
            else{
              console.log('web url')
              this.voyager_cur = CreateVoyager(this.voyager_widget.node, VoyagerPanel.config, values['data']);
            } 
          }
          else if(DATA['values']){ //check if it's array value data source
           this.voyager_cur = CreateVoyager(this.voyager_widget.node, VoyagerPanel.config, values['data']);
          }
          else{//other conditions, just try to pass the value to voyager and wish the best
            this.voyager_cur = CreateVoyager(this.voyager_widget.node, VoyagerPanel.config, values['data']);
            this.data_src = values['data'];
          }
        }
        else{ //other conditions, just try to pass the value to voyager and wish the best
          this.voyager_cur = CreateVoyager(this.voyager_widget.node, VoyagerPanel.config, { values });
          this.data_src = {values};
        }
        console.log('mark": '+values['mark']);
        console.log('encoding '+values['encoding']);
        console.log('config '+values['config']);
        
        //update the specs if possible
        this.voyager_cur.setSpec({
            "mark": values['mark'], 
            "encoding": values['encoding'], 
            "height":values['height'], 
            "width":values['width'], 
            "description":values['description'],
            "name":values['name'],
            "selection":values['selection'],
            "title":values['title'],
            "transform":values['transform']
        });

      }
      else{
        this.voyager_cur = CreateVoyager(this.voyager_widget.node, VoyagerPanel.config, { values });
        this.data_src = {values};
      }
    })

    // Toolbar
    this.toolbar = new Toolbar();
    this.toolbar.addClass(VOYAGER_PANEL_TOOLBAR_CLASS);
    this.toolbar.addItem('save', createSaveButton(this));
    this.toolbar.addItem('saveAs', createExportButton(this,app,docManager));
    this.toolbar.addItem('ExportToNotebook', createCopyButton(this,app,docManager));
    this.toolbar.addItem('undo', createUndoButton(this));
    this.toolbar.addItem('redo', createRedoButton(this));
   // this.toolbar.addItem('Bookmarks', createBookMarkButton(this));
    BoxLayout.setStretch(this.toolbar, 0);
    BoxLayout.setStretch(this.voyager_widget, 1);
    layout.addWidget(this.toolbar);
    layout.addWidget(this.voyager_widget);
    //this.toolbar.hide();
  }

  /**
   * Get the context for the editor widget.
   */
  get context(): DocumentRegistry.Context {
    if(this._context.path.indexOf('vl.json')!==-1){
    var datavoyager = this.voyager_cur;
    var dataSrc = this.data_src;
    //let aps = datavoyager.getApplicationState();
    let spec = datavoyager.getSpec(false);
    this._context.model.fromJSON({
      "data":dataSrc, 
      "mark": spec.mark, 
      "encoding": spec.encoding, 
      "height":spec.height, 
      "width":spec.width, 
      "description":spec.description,
      "name":spec.name,
      "selection":spec.selection,
      "title":spec.title,
      "transform":spec.transform
    });
    }
    //context.model.fromJSON(spec);
    //this._context.save();
    return this._context;
  }

  /**
   * Tests whether the settings have been modified and need saving.
   */
  get isDirty(): boolean {
    if(this._context.path.indexOf('vl.json')!==-1){
      return true;
    }
    else{
      return false;
    }
  }

  /**
   * The plugin settings.
   */
  get settings(): ISettingRegistry.ISettings | null {
    return this._settings;
  }
  set settings(settings: ISettingRegistry.ISettings | null) {
    if (this._settings) {
      this._settings.changed.disconnect(this._onSettingsChanged, this);
    }
    this._settings = settings;
    if (this._settings) {
      this._settings.changed.connect(this._onSettingsChanged, this);
    }
    this.update();
  }
    /**
   * Handle setting changes.
   */
  private _onSettingsChanged(): void {
    this.update();
  }

  private _settings: ISettingRegistry.ISettings | null = null;


  /**
   * A promise that resolves when the file editor is ready.
   */
  get ready(): Promise<void> {
    return this._ready.promise;
  }

  private _onPathChanged(): void {
    this.title.label = PathExt.basename(this._context.localPath);
  }

  /**
   * Dispose of the resources used by the widget.
   */
  dispose(): void {
    if (this._monitor) {
      this._monitor.dispose();
    }
    super.dispose();
  }

    /**
   * If the editor is in a dirty state, confirm that the user wants to leave.
   
  confirm(): Promise<void> {
    if (this.isHidden || !this.isAttached || !this.isDirty) {
      return Promise.resolve(undefined);
    }

    return showDialog({
      title: 'You have unsaved changes.',
      body: 'Do you want to leave without saving?',
      buttons: [Dialog.cancelButton(), Dialog.okButton()]
    }).then(result => {
      if (!result.button.accept) {
        throw new Error('User cancelled.');
      }
    });
  }*/



  /**
   * A signal that emits when editor layout state changes and needs to be saved.
   */
  get stateChanged(): ISignal<this, void> {
    return this._stateChanged;
  }

    /**
   * Handle `'activate-request'` messages.
   */
  protected onActivateRequest(msg: Message): void {
    this.voyager_widget.node.tabIndex = -1;
    this.voyager_widget.node.focus();
  }

  protected _context: DocumentRegistry.Context;
  private _ready = new PromiseDelegate<void>();
  private _monitor: ActivityMonitor<any, any> | null = null;
  private _stateChanged = new Signal<this, void>(this);
  
}

/**Special VoyagerPanel for using dataframe as data src */
export
class VoyagerPanel_DF extends Widget implements DocumentRegistry.IReadyWidget {
  static config: VoyagerConfig = {
    // don't allow user to select another data source from Voyager UI
    showDataSourceSelector: false,
    serverUrl: null,
    hideHeader: true,
    hideFooter: true,
    relatedViews: 'initiallyCollapsed',
    wildcards: 'enabled'

  }
  public voyager_cur: Voyager;
  public voyager_widget: Widget;
  public data_src:any;
  public fileType = 'tempory';
  public toolbar:Toolbar<Widget>;
  protected _context: DocumentRegistry.Context;
  private _ready = new PromiseDelegate<void>();
  private _monitor: ActivityMonitor<any, any> | null = null;

  constructor(data: any, fileName: string, context:Context<DocumentRegistry.IModel>, isTable:boolean,app:JupyterLab, docManager: IDocumentManager) {
    super();
    this.addClass(Voyager_CLASS);
    this._context = context;

    let layout = this.layout = new BoxLayout({spacing: 0});
    layout.direction = 'top-to-bottom';

    this.voyager_widget = new Widget();
    this._context.ready.then(_ => {
    this._ready.resolve(undefined);
    if(isTable){
      this.voyager_cur = CreateVoyager(this.voyager_widget.node, VoyagerPanel.config, data);
    }
    else{
      var DATA = data['data'];
      this.data_src = DATA;
      console.log(data['data']);
      if(DATA['url']){ //check if it's url type datasource
      //console.log('dataurl is: '+DATA['url'])
      //fetch(DATA['url']).then(response => {console.log(response.json())})

        if(!isValidURL(DATA['url'])){
          
          console.log('local url');
          let basePath = PathExt.dirname(this._context.localPath)
          console.log(basePath)
          let filePath = PathExt.basename(DATA['url'])
          let wholePath = path.join(basePath, filePath)
          console.log(wholePath)

          docManager.services.contents.get(wholePath).then(src=>{
            console.log(src.content);
            let local_filetype = PathExt.extname(DATA['url']).substring(1);
            let local_values = read(src.content, { type: local_filetype })
            this.voyager_cur = CreateVoyager(this.voyager_widget.node, VoyagerPanel.config, {'values':local_values});
          })          
        }
        else{
          console.log('web url')
          this.voyager_cur = CreateVoyager(this.voyager_widget.node, VoyagerPanel.config, data['data']);
        } 
      }
      else if(DATA['values']){ //check if it's array value data source
       this.voyager_cur = CreateVoyager(this.voyager_widget.node, VoyagerPanel.config, data['data']);
      }
      else{//other conditions, just try to pass the value to voyager and wish the best
        this.voyager_cur = CreateVoyager(this.voyager_widget.node, VoyagerPanel.config, data['data']);
      }
      this.voyager_cur.setSpec({
        "mark": data['mark'], 
        "encoding": data['encoding'], 
        "height":data['height'], 
        "width":data['width'], 
        "description":data['description'],
        "name":data['name'],
        "selection":data['selection'],
        "title":data['title'],
        "transform":data['transform']
    });
    }
    this.title.label = fileName
    })
    // Toolbar
    this.toolbar = new Toolbar();
    this.toolbar.addClass(VOYAGER_PANEL_TOOLBAR_CLASS);
    this.toolbar.addItem('save', createSaveButton(this));
    this.toolbar.addItem('saveAs', createExportButton(this,app,docManager));
    this.toolbar.addItem('ExportToNotebook', createCopyButton(this,app,docManager));
    this.toolbar.addItem('undo', createUndoButton(this));
    this.toolbar.addItem('redo', createRedoButton(this));
   // this.toolbar.addItem('Bookmarks', createBookMarkButton(this));
    BoxLayout.setStretch(this.toolbar, 0);
    BoxLayout.setStretch(this.voyager_widget, 1);
    layout.addWidget(this.toolbar);
    layout.addWidget(this.voyager_widget);
    //this.toolbar.hide();


  }

  get context(): DocumentRegistry.Context {
    if(this._context.path.indexOf('vl.json')!==-1){
      var datavoyager = this.voyager_cur;
      var dataSrc = this.data_src;
      //let aps = datavoyager.getApplicationState();
      let spec = datavoyager.getSpec(false);
      this._context.model.fromJSON({
        "data":dataSrc, 
        "mark": spec.mark, 
        "encoding": spec.encoding, 
        "height":spec.height, 
        "width":spec.width, 
        "description":spec.description,
        "name":spec.name,
        "selection":spec.selection,
        "title":spec.title,
        "transform":spec.transform
      });
      }
      //context.model.fromJSON(spec);
      //this._context.save();
      return this._context;
  }
  /**
   * A promise that resolves when the file editor is ready.
   */
  get ready(): Promise<void> {
    return this._ready.promise;
  }
/*
  private _onPathChanged(): void {
    this.title.label = PathExt.basename(this._context.localPath);
  }
*/
  /**
   * Dispose of the resources used by the widget.
   */
  dispose(): void {
    if (this._monitor) {
      this._monitor.dispose();
    }
    super.dispose();
  }

    /**
   * Handle `'activate-request'` messages.
   */
  protected onActivateRequest(msg: Message): void {
    this.voyager_widget.node.tabIndex = -1;
    this.voyager_widget.node.focus();
  }


}
