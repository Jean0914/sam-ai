const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { findAppLink } = require('./interpreter_utils');

class SkillsInterpreter {
  constructor(broadcastFunc, waClient) {
    this.broadcast = broadcastFunc || (() => {});
    this.waClient = waClient;
    this.customSkills = [];
    this.actionPlugins = {};
    this.loadCustomSkills(); // .mds files
    this.loadActionPlugins(); // .js files in skills/
  }

  loadCustomSkills() {
    const skillsDir = path.join(__dirname, 'skills');
    if (!fs.existsSync(skillsDir)) return;
    const files = fs.readdirSync(skillsDir).filter(f => f.endsWith('.mds'));
    for (const file of files) {
      try {
        const content = fs.readFileSync(path.join(skillsDir, file), 'utf8');
        const parsed = yaml.load(content);
        if (parsed?.trigger && parsed?.actions) {
          this.customSkills.push({ name: file.replace('.mds', ''), ...parsed });
        }
      } catch (e) {
        console.error(`Error loading .mds skill ${file}:`, e);
      }
    }
  }

  loadActionPlugins() {
    const skillsDir = path.join(__dirname, 'skills');
    if (!fs.existsSync(skillsDir)) return;
    const files = fs.readdirSync(skillsDir).filter(f => f.endsWith('.js'));
    for (const file of files) {
      try {
        const PluginClass = require(path.join(skillsDir, file));
        const plugin = new PluginClass(this);
        const actions = plugin.getActions();
        Object.assign(this.actionPlugins, actions);
        console.log(`[Interpreter] Plugin cargado: ${file} (${Object.keys(actions).length} acciones)`);
      } catch (e) {
        console.error(`Error loading .js plugin ${file}:`, e);
      }
    }
  }

  processCommand(text) {
    text = text.toLowerCase().trim();

    // Custom Skills (.mds)
    for (const skill of this.customSkills) {
      if (skill.trigger.some(t => text.includes(t.toLowerCase()))) {
        return { 
          matched: true, 
          tts: `Iniciando ${skill.name.replace(/_/g, ' ')}...`, 
          actionsToExecute: skill.actions.map(a => typeof a === 'string' ? { type: a } : a) 
        };
      }
    }

    return { matched: false, tts: null, actionsToExecute: [] };
  }

  async executeActions(actions, speakFunc) {
    for (const action of actions) {
      const type = typeof action === 'string' ? action : action.type;
      const param = action.param;
      
      console.log(`[Plugin Engine] Ejecutando: ${type}`);
      
      const actionHandler = this.actionPlugins[type];
      if (actionHandler) {
          try {
              await actionHandler(param, speakFunc);
          } catch (e) {
              console.error(`[Plugin Engine] Error ejecutando acción ${type}:`, e);
              speakFunc(`Tuve un problema al ejecutar la acción: ${type}`);
          }
      } else {
          console.warn(`[Interpreter] Acción desconocida: ${type}`);
      }
    }
  }

  // Utilidad para los plugins
  findAppLink(name) { return findAppLink(name); }
}

module.exports = SkillsInterpreter;
