/**
 * Features module.
 * @module base/features
 */

import observable from 'riot-observable'
import { isElement } from './utils/check'
import { transitionEndEvent } from './utils/dom'
import eventHub from './eventHub'

import {
  ATTR_FEATURES,
  ATTR_FEATURES_IGNORE
 } from './variables'

export var features = {}

/**
 * Reinitializes features.
 *
 * @param {Node} [container=document.body]
 *   Container element to filter where features should be reinitialized.
 * @param {String} [name=null]
 *   Comma separated string with names of the features
 *   (used by the `data-feature` attribute) which sould be reinitialized.
 */
export function reinit(container = document.body, name = null) {
  destroy(container, name)
  init(container, name)
}

/**
 * Initializes features.
 *
 * @example
 * // initialize all features
 * base.features.init()
 * @example
 * // initialize `feature1` and `feature2` instances inside #wrapper
 * base.features.init(document.getElementById('wrapper'), 'feature1,feature2')
 *
 * @param {Node} [container=document.body] Container element
 *   Container element to filter where features should be initialized.
 * @param {String} [name=null]
 *   Comma separated string with names of the features
 *   (used by the `data-feature` attribute) which sould be initialized.
 *
 * @returns {Array} Initialized feature instances.
 */
export function init(container = document.body, name = null) {
  var instances = []
  var names = name ? name.split(',') : null
  var featureNodes = container.querySelectorAll(`[${ATTR_FEATURES}]`)

  eventHub.trigger('features:initialize', {
    container: container,
    names: names,
    nodes: featureNodes
  })

  for (let i = 0, featureNodesLength = featureNodes.length; i < featureNodesLength; i++) {
    var nodeInstances = []
    var featureNode = featureNodes[i]
    var dataFeatures = featureNode.getAttribute(ATTR_FEATURES).split(',')
    var ignoreFeatures = (featureNode.getAttribute(ATTR_FEATURES_IGNORE) || '').split(',')

    dataFeatures.forEach(function(featureName) {
      featureName = featureName.trim()
      var feature = features[featureName]

      if (!feature // feature has not been added yet
          || (ignoreFeatures && ignoreFeatures.indexOf(featureName) > -1) // feature is ignored on this node
          || (name && names.indexOf(featureName) < 0) // name is not whitelisted
          || (featureNode._baseFeatureInstances // feature has already been initalized on this node
              && featureNode._baseFeatureInstances[featureName])) return

      var instance = new feature.featureClass(
        featureName, featureNode, feature.options
      )

      instance.init()
      instances.push(instance)
      nodeInstances.push(instance)
    })

    // trigger event on all instances
    nodeInstances.forEach(function(nodeInstance) {
      nodeInstance.trigger('featuresInitialized', nodeInstances)
    })
  }

  eventHub.trigger('features:initialized', {
    container: container,
    names: names,
    nodes: featureNodes,
    instances: instances
  })

  return instances
}

/**
 * Destroy feature instances.
 *
 * @example
 * // destroy all feature instances
 * base.features.destroy()
 * @example
 * // destroy `feature1` and `feature2` instances inside #wrapper
 * base.features.destroy(document.getElementById('wrapper'), 'feature1,feature2')
 *
 * @param {Node} [container=document.body] Container element
 *   Container element to filter where features should be destroyed.
 * @param {String} [name=null]
 *   Comma separated string with names of the features
 *   (used by the `data-feature` attribute) which sould be initialized.
 */
export function destroy(container = document.body, name = null) {
  var names = name ? name.split(',') : null
  var featureNodes = container.querySelectorAll(`[${ATTR_FEATURES}]`)

  eventHub.trigger('features:destroy', {
    container: container,
    names: names,
    nodes: featureNodes
  })

  for (let i = 0, featureNodesLength = featureNodes.length; i < featureNodesLength; i++) {
    var featureNode = featureNodes[i]
    var nodeInstances = getInstancesByNode(featureNode)
    var ignoreFeatures = (featureNode.getAttribute(ATTR_FEATURES_IGNORE) || '').split(',')

    for (let featureName in nodeInstances) {
      if (nodeInstances.hasOwnProperty(featureName)
          && (!name || names.indexOf(featureName) > -1) // name is whitelisted
          && (!ignoreFeatures || ignoreFeatures.indexOf(featureName) < 0) // feature is ignore on this node
          && (featureNode._baseFeatureInstances // feature instance exists
              && featureNode._baseFeatureInstances[featureName])
      ) {
        nodeInstances[featureName].destroy()
        nodeInstances[featureName] = null
      }
    }
  }

  eventHub.trigger('features:destroyed', {
    container: container,
    names: names,
    nodes: featureNodes
  })
}

/**
 * Add feature
 *
 * @example
 * // add feature `deathStar`
 * base.features.add('deathStar', DeathStar, { destroyAlderaan: true })
 *
 * @param {String} name
 *   Name of the feature used by the `data-feature` attribute.
 * @param {Feature} featureClass
 *   Feature class to initiate.
 * @param {Object} options
 *   Any options to initialize the feature with.
 */
export function add(name, featureClass, options = {}) {
  if (features[name]) {
    throw new Error('Feature "'+ name +'" has been already added!')
  }

  features[name] = { featureClass, options }
}

/**
 * Return all initialized feature instances from given node.
 *
 * @example
 * // get all the feature instances
 * var features = base.features.getInstancesByNode(document.getElementById('deathstar'))
 * // do something with one of the features
 * features.deathStar.destroy()
 *
 * @param {Node} node
 *   Node to return the instances from.
 * @returns {Object|null}
 *   Feature instances indexed by name (used by `data-feature` attribute).
 */
export function getInstancesByNode(node) {
  return node._baseFeatureInstances || null
}

/**
 * Return initialized feature instance from given node and name.
 *
 * @example
 * // get feature instance
 * var deathStar = base.features.getInstancesByNode(document.getElementById('deathstar'), 'deathStar')
 * // do something with the feature
 * deathStar.destroy()
 *
 * @param {Node} node
 *   Node to return the instance from.
 * @param {String} name
 *   Name used by `data-feature` attribute.
 *
 * @returns {module:base/features~Feature|null} Feature instance.
 */
export function getInstanceByNode(node, name) {
  if (!node._baseFeatureInstances) {
    return null
  }

  return node._baseFeatureInstances[name] || null
}




/**
 * Abstract Feature class.
 * @abstract
 */
export class Feature {

  /**
   * Constructor.
   *
   * @param {String} name
   *   Name of the feature used by the `data-feature` attribute.
   * @param {Node} node
   *   Node the feature belongs to.
   * @param {Object} options
   *   Feature options which can be used for anything.
   */
  constructor(name, node, options) {
    if (this.constructor === Feature) {
      throw new Error("Can't instantiate abstract class!")
    }

    observable(this)

    var defaultOptions = this.constructor.defaultOptions || {}

    this._name = name
    this._node = node
    this._options = Object.assign({}, defaultOptions, options)

    this._hubEvents = {}
    this._eventListener = {}

    if (!this._node._baseFeatureInstances) {
      this._node._baseFeatureInstances = {}
    }

    this._node._baseFeatureInstances[name] = this
  }

  /**
   * Return name the feature has been initialized with.
   * @returns {String}
   */
  get name() { return this._name }

  /**
   * Return node the feature belongs to.
   * @returns {Node}
   */
  get node() { return this._node }

  /**
   * Replaces current feature node with given one.
   * @param {Node} node - Replacement ndoe.
   */
  replaceNode(node) {
    var replacedNode = this._node.parentElement.replaceChild(node, this._node)
    this._node = node
    return replacedNode
  }

  /**
   * Return given options the feature has been initialized with.
   * @returns {Object}
   */
  get options() { return this._options }

  /**
   * Return first element by given selector inside the feature node.
   *
   * @param   {String} selector - CSS selector
   * @returns {Element}
   */
  $(selector) { return this._node.querySelector(selector) }

  /**
   * Return all elements by given selector inside the feature node as array.
   *
   * @param   {String} selector - CSS selector
   * @returns {Element[]}
   */
  $$(selector) { return [...this._node.querySelectorAll(selector)] }

  /**
   * Add event listener to given node.
   *
   * @param {Node|NodeList} node - Node to add event listener to.
   * @param {String} type - Event type to add.
   * @param {Function} fn - Event handler
   */
  addEventListener(node, type, fn) {
    if (!isElement(node) && node !== window) {
      var currentNode = node.length
      while (currentNode--) {
        this.addEventListener(node[currentNode], type, fn)
      }
      return
    }

    node.addEventListener(type, fn)

    if (!this._eventListener[type]) {
      this._eventListener[type] = []
    }

    this._eventListener[type].push({node, fn})
  }

  /**
   * Remove event listener from given node.
   *
   * @param {Node|NodeList} node
   *   Node to remove the event listener from.
   * @param {String|null} [type=null]
   *   Event type to remove (leave empty to remove listeners of all event types).
   * @param {Function|null} [fn=null]
   *   Handler to remove (leave empty to remove all listeners).
   */
  removeEventListener(node, type = null, fn = null) {
    if (!isElement(node) && node !== window) {
      var currentNode = node.length
      while (currentNode--) {
        this.removeEventListener(node[currentNode], type, fn)
      }
      return
    }

    if (type && fn) {
      node.removeEventListener(type, fn)

      this._eventListener[type].forEach((listener, i) => {
        if (node == listener.node && fn == listener.fn) {
          this._eventListener[type].splice(i, 1)
        }
      })
    } else if (type) {
      this._eventListener[type].forEach((listener, i) => {
        if (node == listener.node) {
          node.removeEventListener(type, listener.fn)
          this._eventListener[type].splice(i, 1)
        }
      })
    } else if (fn) {
      this.removeAllEventListener(node, fn)
    } else {
      this.removeAllEventListener(node)
    }
  }

  /**
   * Remove all listeners added by this feature.
   *
   * @param {Node|null} [node=null]
   *   Limit removing event listeners on given node.
   * @param {Function|null} [fn=null]
   *   Limit removing event listeners on given handler.
   */
  removeAllEventListener(node = null, fn = null) {
    if (node && !isElement(node) && node !== window) {
      var currentNode = node.length
      while (currentNode--) {
        this.removeAllEventListener(node[currentNode], fn)
      }
      return
    }

    for (let type in this._eventListener) {
      if (this._eventListener.hasOwnProperty(type)) {
        this._eventListener[type].forEach((listener) => {
          if ((!node || node == listener.node)
              && (!fn || fn == listener.fn)
          ) {
            listener.node.removeEventListener(type, listener.fn)
          }
        })
      }
    }

    // reset internal references to event listeners
    this._eventListener = {}
  }

  /** Add event to global event hub. */
  onHub(event, fn) {
    eventHub.on(event, fn)

    if (!this._hubEvents[event]) {
      this._hubEvents[event] = []
    }

    this._hubEvents[event].push(fn)
  }

  /** Remove event from global event hub. */
  offHub(event, fn = null) {
    if (event && fn) {
      eventHub.off(event, fn)

      this._hubEvents[event].forEach((listener, i) => {
        if (fn == listener) {
          this._hubEvents[event].splice(i, 1)
        }
      })
    } else if (event) {
      this._hubEvents[event].forEach((listener, i) => {
          eventHub.off(event, listener)
          this._hubEvents[event].splice(i, 1)
      })
    }
  }

  /** Remove all events from global event hub added by this feature. */
  offAllHub() {
    for (let event in this._hubEvents) {
      if (this._hubEvents.hasOwnProperty(event)) {
        this._hubEvents[event].forEach((listener) => {
          eventHub.off(event, listener)
        })
      }
    }

    // reset internal referencens to hub events
    this._hubEvents = {}
  }

  /** Initialize feature. */
  init() {}

  /** Destroy feature. */
  destroy() {
    this.trigger('destroy')

    // remove all registered event listeners
    this.removeAllEventListener()

    // remove all events from global event hub
    this.offAllHub()

    // destroy all features inside
    destroy(this._node)

    // remove feature instance from node
    this._node._baseFeatureInstances[name] = null
    delete this._node._baseFeatureInstances[name]

    // clean up properties
    this._name = null
    this._node = null
    this._options = null

    this.trigger('destroyed')
  }

}


export default {
  /**
   * Feature class.
   * @see module:base/features~Feature
   */
  Feature,

  init, destroy, reinit, add,
  getInstanceByNode,
  getInstancesByNode,

  /**
   * Features added to current site.
   * @type {Object}
   */
  features
}
